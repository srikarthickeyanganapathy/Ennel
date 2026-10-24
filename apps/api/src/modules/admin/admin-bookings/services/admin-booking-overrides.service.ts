import { Injectable } from '@nestjs/common';
import {
  type AdminBooking,
  type adminCancelBookingRequestSchema,
  type adminCorrectStatusRequestSchema,
  type adminCreateBookingRequestSchema,
  type adminMoveBookingRequestSchema,
  ErrorCode,
} from '@ennel/shared';
import { type z } from 'zod';
import { AppError } from '../../../../common/errors/app-error';
import {
  type TransactionClient,
  TransactionRunner,
} from '../../../../infrastructure/database/transaction-runner';
import {
  type BookingRow,
  BookingsRepository,
} from '../../../bookings/repositories/bookings.repository';
import {
  type BookingActor,
  BookingCommandsService,
} from '../../../bookings/services/booking-commands.service';
import { bookingChanged, bookingNotFound } from '../../../bookings/services/booking-errors';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { AdminBookingsRepository } from '../repositories/admin-bookings.repository';

type CreateRequest = z.output<typeof adminCreateBookingRequestSchema>;
type CancelRequest = z.output<typeof adminCancelBookingRequestSchema>;
type MoveRequest = z.output<typeof adminMoveBookingRequestSchema>;
type CorrectRequest = z.output<typeof adminCorrectStatusRequestSchema>;
type StaffActor = Extract<BookingActor, { type: 'STAFF' }>;

/**
 * Staff overrides on bookings (Admin §H, BR-DEAD-7): they may bypass student deadlines, always
 * need a reason, are flagged as overrides in the audit log, and show the student
 * "Updated by mess staff". Each one is audited in the same transaction as the change.
 */
@Injectable()
export class AdminBookingOverridesService {
  constructor(
    private readonly commands: BookingCommandsService,
    private readonly bookings: BookingsRepository,
    private readonly grid: AdminBookingsRepository,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
  ) {}

  create(staffId: string, request: CreateRequest): Promise<AdminBooking> {
    const actor: StaffActor = { type: 'STAFF', staffId, reason: request.reason };
    return this.transactions.run(async (tx) => {
      if (!(await this.grid.studentExists(request.studentId, tx))) {
        throw new AppError(ErrorCode.NOT_FOUND, 'Student not found or deactivated.');
      }
      const { bookingId } = await this.commands.book(actor, request, tx);
      return this.audited(tx, 'booking.override.create', bookingId, null, request.reason);
    });
  }

  cancel(staffId: string, bookingId: string, request: CancelRequest): Promise<AdminBooking> {
    return this.override(
      staffId,
      bookingId,
      request,
      'booking.override.cancel',
      (actor, booking, tx) => this.commands.cancel(actor, booking, tx),
    );
  }

  move(staffId: string, bookingId: string, request: MoveRequest): Promise<AdminBooking> {
    return this.override(
      staffId,
      bookingId,
      request,
      'booking.override.move',
      (actor, booking, tx) =>
        this.commands.change(
          actor,
          booking,
          { slotId: request.slotId, dietType: request.dietType, version: request.version },
          tx,
        ),
    );
  }

  correctStatus(
    staffId: string,
    bookingId: string,
    request: CorrectRequest,
  ): Promise<AdminBooking> {
    return this.override(
      staffId,
      bookingId,
      request,
      'booking.override.correct-status',
      (actor, booking, tx) => this.commands.correctStatus(actor, booking, request.status, tx),
    );
  }

  private override(
    staffId: string,
    bookingId: string,
    request: { reason: string; version: number },
    action: string,
    run: (actor: StaffActor, booking: BookingRow, tx: TransactionClient) => Promise<unknown>,
  ): Promise<AdminBooking> {
    const actor: StaffActor = { type: 'STAFF', staffId, reason: request.reason };
    return this.transactions.run(async (tx) => {
      const booking = await this.bookings.findBooking(bookingId, tx);
      if (!booking) throw bookingNotFound();
      // The grid sends the version it showed, so a colleague's change is never overwritten.
      if (booking.version !== request.version) throw bookingChanged();
      const before = await this.grid.findOne(bookingId, tx);
      await run(actor, booking, tx);
      return this.audited(tx, action, bookingId, before, request.reason);
    });
  }

  private async audited(
    tx: TransactionClient,
    action: string,
    bookingId: string,
    before: AdminBooking | null,
    reason: string,
  ): Promise<AdminBooking> {
    const after = await this.grid.findOne(bookingId, tx);
    if (!after) throw bookingNotFound();
    await this.audit.write(tx, {
      action,
      entityType: 'booking',
      entityId: bookingId,
      before: before && snapshot(before),
      after: snapshot(after),
      reason,
      isOverride: true,
    });
    return after;
  }
}

export function snapshot(booking: AdminBooking) {
  return {
    studentId: booking.studentId,
    date: booking.date,
    mealType: booking.mealType,
    slotId: booking.slotId,
    slotLabel: booking.slotLabel,
    dietType: booking.dietType,
    status: booking.status,
  };
}
