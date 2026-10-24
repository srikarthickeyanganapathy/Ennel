import { Injectable } from '@nestjs/common';
import {
  type ClosureResult,
  type createClosureRequestSchema,
  ErrorCode,
  type MealType,
  toBusinessDate,
} from '@ennel/shared';
import { type z } from 'zod';
import { AppError } from '../../../../common/errors/app-error';
import { Clock } from '../../../../infrastructure/clock/clock';
import {
  type TransactionClient,
  TransactionRunner,
} from '../../../../infrastructure/database/transaction-runner';
import { BookingsRepository } from '../../../bookings/repositories/bookings.repository';
import { NotifyStudentsService } from '../../../notifications/services/notify-students.service';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import {
  type AffectedBooking,
  AdminClosuresRepository,
} from '../repositories/admin-closures.repository';
import { formatDay, MEAL_NAMES } from './closure-notices';

type CreateRequest = z.output<typeof createClosureRequestSchema>;

/** Large closures touch every booking of a meal; well above Prisma's 5-second default. */
const CLOSURE_TIMEOUT_MS = 60_000;

/**
 * Admin §F, BR-CLOS-1: closes the mess for one date and one or more meals. Booked meals become
 * "Mess closed" (so no No-show can be recorded), students are notified, and the change is
 * audited, all in one transaction.
 */
@Injectable()
export class ApplyClosureService {
  constructor(
    private readonly closures: AdminClosuresRepository,
    private readonly bookings: BookingsRepository,
    private readonly notify: NotifyStudentsService,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
    private readonly clock: Clock,
  ) {}

  execute(staffId: string, request: CreateRequest): Promise<ClosureResult> {
    const now = this.clock.now();
    if (request.date < toBusinessDate(now))
      throw invalid('date', 'Closures can only be set for today or later.');
    return this.transactions.run(
      async (tx) => {
        const mealIds = await this.mealIdsFor(request.mealTypes, request.date, tx);
        const id = await this.closures.create(
          { ...request, mealIds: [...mealIds.values()], staffId },
          tx,
        );
        const affected = await this.closures.bookingsWithStatus(
          request.date,
          [...mealIds.values()],
          'BOOKED',
          tx,
        );
        for (const booking of affected)
          await this.closeBooking(booking, staffId, request.reason, now, tx);
        await this.notifyStudents(id, request, affected, tx);
        await this.audit.write(tx, {
          action: 'closure.create',
          entityType: 'mess_closure',
          entityId: id,
          after: {
            date: request.date,
            mealTypes: request.mealTypes,
            kind: request.kind,
            title: request.title,
            cancelledBookings: affected.length,
          },
          reason: request.reason,
        });
        const closure = await this.closures.findById(id, tx);
        if (!closure) throw new AppError(ErrorCode.NOT_FOUND, 'Closure not found.');
        return { closure, cancelled: affected.length, restored: 0, notRestored: 0 };
      },
      { timeoutMs: CLOSURE_TIMEOUT_MS },
    );
  }

  private async mealIdsFor(
    mealTypes: MealType[],
    date: string,
    tx: TransactionClient,
  ): Promise<Map<MealType, string>> {
    const mealIds = await this.closures.mealIds(mealTypes, tx);
    const missing = mealTypes.filter((meal) => !mealIds.has(meal));
    if (missing.length > 0)
      throw invalid(
        'mealTypes',
        `${missing.map((meal) => MEAL_NAMES[meal]).join(', ')} is not being served.`,
      );
    const closed = await this.closures.alreadyClosed(date, [...mealIds.values()], tx);
    if (closed.length > 0) {
      throw invalid(
        'mealTypes',
        `${closed.map((meal) => MEAL_NAMES[meal]).join(', ')} is already closed on this date.`,
      );
    }
    return mealIds;
  }

  private async closeBooking(
    booking: AffectedBooking,
    staffId: string,
    reason: string,
    now: Date,
    tx: TransactionClient,
  ): Promise<void> {
    const write = {
      status: 'CANCELLED_BY_CLOSURE' as const,
      cancelledAt: now,
      isOverCapacity: false,
    };
    if (!(await this.bookings.updateBooking(booking.id, booking.version, write, tx))) {
      throw new AppError(
        ErrorCode.VERSION_CONFLICT,
        'A booking changed while closing. Please try again.',
      );
    }
    await this.bookings.addEvent(
      {
        bookingId: booking.id,
        type: 'CANCELLED_BY_CLOSURE',
        fromStatus: 'BOOKED',
        toStatus: 'CANCELLED_BY_CLOSURE',
        actorType: 'STAFF',
        actorStaffId: staffId,
        reason,
      },
      tx,
    );
  }

  private async notifyStudents(
    closureId: string,
    request: CreateRequest,
    affected: AffectedBooking[],
    tx: TransactionClient,
  ): Promise<void> {
    for (const mealType of request.mealTypes) {
      const studentIds = affected
        .filter((booking) => booking.mealType === mealType)
        .map((booking) => booking.studentId);
      if (studentIds.length === 0) continue;
      await this.notify.notifyWithin(tx, {
        studentIds,
        category: 'BOOKING',
        title: `Mess closed: ${MEAL_NAMES[mealType]} on ${formatDay(request.date)}`,
        body: `${request.title}. Your booking was cancelled and no No-show will be recorded.`,
        relatedEntityType: 'mess_closure',
        relatedEntityId: closureId,
        dedupeKey: `closure:${closureId}:${mealType}`,
      });
    }
  }
}

function invalid(path: string, message: string): AppError {
  return new AppError(ErrorCode.VALIDATION_FAILED, message, { issues: [{ path, message }] });
}
