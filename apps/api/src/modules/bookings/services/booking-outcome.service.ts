import { Injectable } from '@nestjs/common';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';
import { BookingsRepository } from '../repositories/bookings.repository';

export interface OutcomeBooking {
  id: string;
  version: number;
  /** BOOKED normally; NO_SHOW when attendance imported after an outage resolves a held No-show. */
  status: 'BOOKED' | 'NO_SHOW';
}

/** Who caused the outcome: staff marking attendance, or the system (provider, import, job). */
export type OutcomeActor = { type: 'STAFF'; staffId: string } | { type: 'SYSTEM' };

/**
 * The two final states a Booked meal reaches through attendance (Spec §7, BR-NS-1). Owned by the
 * bookings module so attendance code never writes bookings directly. Each returns false when the
 * booking changed in the meantime (optimistic version check).
 */
@Injectable()
export class BookingOutcomeService {
  constructor(private readonly bookings: BookingsRepository) {}

  complete(booking: OutcomeBooking, actor: OutcomeActor, tx: TransactionClient): Promise<boolean> {
    return this.finish(booking, 'COMPLETED', 'COMPLETED', actor, tx);
  }

  markNoShow(booking: OutcomeBooking, tx: TransactionClient): Promise<boolean> {
    return this.finish(booking, 'NO_SHOW', 'MARKED_NO_SHOW', { type: 'SYSTEM' }, tx);
  }

  private async finish(
    booking: OutcomeBooking,
    status: 'COMPLETED' | 'NO_SHOW',
    eventType: 'COMPLETED' | 'MARKED_NO_SHOW',
    actor: OutcomeActor,
    tx: TransactionClient,
  ): Promise<boolean> {
    const staffId = actor.type === 'STAFF' ? actor.staffId : null;
    const isUpdated = await this.bookings.updateBooking(
      booking.id,
      booking.version,
      // Only the status: attendance is not an override, so "Updated by mess staff" stays as it was.
      { status },
      tx,
    );
    if (!isUpdated) return false;
    await this.bookings.addEvent(
      {
        bookingId: booking.id,
        type: eventType,
        fromStatus: booking.status,
        toStatus: status,
        actorType: actor.type,
        actorStaffId: staffId,
        reason: null,
      },
      tx,
    );
    return true;
  }
}
