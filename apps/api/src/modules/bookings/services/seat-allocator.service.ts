import { Injectable } from '@nestjs/common';
import { type BusinessDate } from '@ennel/shared';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';
import { type MessPolicy } from '../../mess-config/domain/mess-policy';
import { BookingsRepository } from '../repositories/bookings.repository';
import { slotUnavailable } from './booking-errors';

export type SeatResult = { isAvailable: true; isOverCapacity: boolean } | { isAvailable: false };

/**
 * Seats for one slot and date (BR-CAP-4, ADR-0004/0005). The count is read under the slot/date
 * advisory lock, which is held until the transaction ends, so two writers can never take the
 * last seat. Shared by student bookings, staff overrides, Default Booking generation and
 * closure restoration.
 */
@Injectable()
export class SeatAllocator {
  constructor(private readonly bookings: BookingsRepository) {}

  /** A seat, or SLOT_UNAVAILABLE when the slot is full and over-capacity booking is off. */
  async reserve(
    slotId: string,
    date: BusinessDate,
    policy: MessPolicy,
    tx: TransactionClient,
  ): Promise<boolean> {
    const result = await this.tryReserve(slotId, date, policy, tx);
    if (!result.isAvailable)
      throw slotUnavailable('This slot is full. Please choose another slot.');
    return result.isOverCapacity;
  }

  /** Like `reserve`, but reports a full slot instead of failing (for generation fallbacks). */
  async tryReserve(
    slotId: string,
    date: BusinessDate,
    policy: MessPolicy,
    tx: TransactionClient,
  ): Promise<SeatResult> {
    await this.bookings.lockSlot(slotId, date, tx);
    const seats = await this.bookings.seatsInUse(slotId, date, tx);
    const capacity = await this.bookings.officialCapacity(slotId, date, tx);
    if (seats < capacity) return { isAvailable: true, isOverCapacity: false };
    return policy.allowOverCapacityBooking
      ? { isAvailable: true, isOverCapacity: true }
      : { isAvailable: false };
  }
}
