import { Injectable } from '@nestjs/common';
import {
  type AdminBooking,
  type bulkBookingApplyRequestSchema,
  type bulkBookingPreviewRequestSchema,
  type BulkBookingResult,
} from '@ennel/shared';
import { type z } from 'zod';
import { AppError } from '../../../../common/errors/app-error';
import {
  type TransactionClient,
  TransactionRunner,
} from '../../../../infrastructure/database/transaction-runner';
import {
  BookingsRepository,
  type SlotRow,
} from '../../../bookings/repositories/bookings.repository';
import { BookingCommandsService } from '../../../bookings/services/booking-commands.service';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { AdminBookingsRepository } from '../repositories/admin-bookings.repository';
import { snapshot } from './admin-booking-overrides.service';

type PreviewRequest = z.output<typeof bulkBookingPreviewRequestSchema>;
type ApplyRequest = z.output<typeof bulkBookingApplyRequestSchema>;
type Skipped = BulkBookingResult['skipped'];

/** Up to 500 bookings with seat locks; well above Prisma's 5-second default. */
const BULK_TIMEOUT_MS = 60_000;

/**
 * Admin §H bulk actions: a preview lists what would change and why some would be skipped;
 * apply re-checks each booking, changes the rest, and audits every change.
 */
@Injectable()
export class BulkBookingsService {
  constructor(
    private readonly grid: AdminBookingsRepository,
    private readonly bookings: BookingsRepository,
    private readonly commands: BookingCommandsService,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
  ) {}

  preview(request: PreviewRequest): Promise<BulkBookingResult> {
    return this.transactions.run(async (tx) => {
      const { eligible, skipped } = await this.partition(request, tx);
      return { affected: eligible, skipped };
    });
  }

  apply(staffId: string, request: ApplyRequest): Promise<BulkBookingResult> {
    const actor = { type: 'STAFF' as const, staffId, reason: request.reason };
    return this.transactions.run(
      async (tx) => {
        const { eligible, skipped } = await this.partition(request, tx);
        const changedIds: string[] = [];
        for (const item of eligible) {
          const outcome = await this.applyOne(actor, request, item, tx);
          if (typeof outcome === 'string') skipped.push({ id: item.id, reason: outcome });
          else changedIds.push(item.id);
        }
        return { affected: await this.grid.findMany(changedIds, tx), skipped };
      },
      { timeoutMs: BULK_TIMEOUT_MS },
    );
  }

  /** Returns the refusal message when a booking could not be changed (e.g. the slot filled up). */
  private async applyOne(
    actor: { type: 'STAFF'; staffId: string; reason: string },
    request: ApplyRequest,
    item: AdminBooking,
    tx: TransactionClient,
  ): Promise<string | true> {
    const booking = await this.bookings.findBooking(item.id, tx);
    if (!booking) return 'Booking not found.';
    try {
      if (request.action === 'CANCEL') await this.commands.cancel(actor, booking, tx);
      else
        await this.commands.change(
          actor,
          booking,
          { slotId: request.slotId, version: booking.version },
          tx,
        );
    } catch (error) {
      // Refusals are checked before any write, so the transaction is still usable.
      if (error instanceof AppError) return error.message;
      throw error;
    }
    const after = await this.grid.findOne(item.id, tx);
    await this.audit.write(tx, {
      action: request.action === 'CANCEL' ? 'booking.bulk.cancel' : 'booking.bulk.move',
      entityType: 'booking',
      entityId: item.id,
      before: snapshot(item),
      after: after && snapshot(after),
      reason: request.reason,
      isOverride: true,
    });
    return true;
  }

  private async partition(
    request: PreviewRequest,
    tx: TransactionClient,
  ): Promise<{ eligible: AdminBooking[]; skipped: Skipped }> {
    const found = await this.grid.findMany(request.bookingIds, tx);
    const target =
      request.action === 'MOVE' && request.slotId
        ? await this.bookings.findSlot(request.slotId, tx)
        : null;
    const skipped: Skipped = request.bookingIds
      .filter((id) => !found.some((booking) => booking.id === id))
      .map((id) => ({ id, reason: 'Booking not found.' }));
    const eligible: AdminBooking[] = [];
    for (const booking of found) {
      const reason = whySkipped(booking, request, target);
      if (reason) skipped.push({ id: booking.id, reason });
      else eligible.push(booking);
    }
    return { eligible, skipped };
  }
}

function whySkipped(
  booking: AdminBooking,
  request: PreviewRequest,
  target: (SlotRow & { mealType: string }) | null,
): string | null {
  if (booking.status !== 'BOOKED') return 'Only booked meals can be changed.';
  if (request.action !== 'MOVE') return null;
  if (!target || !target.isActive) return 'The target slot is not available.';
  if (target.mealType !== booking.mealType) return 'The target slot belongs to another meal.';
  if (target.id === booking.slotId) return 'Already in this slot.';
  return null;
}
