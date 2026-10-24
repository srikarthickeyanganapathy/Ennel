import { Injectable } from '@nestjs/common';
import { type BusinessDate, type ClosureResult, ErrorCode, toInstant } from '@ennel/shared';
import { AppError } from '../../../../common/errors/app-error';
import { Clock } from '../../../../infrastructure/clock/clock';
import {
  type TransactionClient,
  TransactionRunner,
} from '../../../../infrastructure/database/transaction-runner';
import { fallbackOrder } from '../../../bookings/domain/fallback-slot';
import { isDeadlinePassed } from '../../../bookings/domain/meal-card-rules';
import {
  BookingsRepository,
  type MealDayRow,
} from '../../../bookings/repositories/bookings.repository';
import { resolveMeal } from '../../../bookings/services/meal-resolution';
import { SeatAllocator } from '../../../bookings/services/seat-allocator.service';
import { type MessPolicy } from '../../../mess-config/domain/mess-policy';
import { GetMessPolicyService } from '../../../mess-config/services/get-mess-policy.service';
import { NotifyStudentsService } from '../../../notifications/services/notify-students.service';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import {
  type AffectedBooking,
  AdminClosuresRepository,
} from '../repositories/admin-closures.repository';
import { formatDay } from './closure-notices';

interface RestoreContext {
  closureId: string;
  date: BusinessDate;
  now: Date;
  policy: MessPolicy;
  tx: TransactionClient;
}

type Outcome = 'RESTORED' | 'NOT_RESTORED';

/**
 * ADR-0017, BR-CLOS-2: removing a closure re-runs the resolver for each "Mess closed" booking.
 * Bookings whose intent still holds are restored (using the full-slot fallback if needed);
 * the others are left closed and the student is told they can book again. Slots that have
 * already started are not restored.
 */
@Injectable()
export class RemoveClosureService {
  constructor(
    private readonly closures: AdminClosuresRepository,
    private readonly bookings: BookingsRepository,
    private readonly seats: SeatAllocator,
    private readonly notify: NotifyStudentsService,
    private readonly policies: GetMessPolicyService,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
    private readonly clock: Clock,
  ) {}

  async execute(staffId: string, closureId: string, reason: string): Promise<ClosureResult> {
    const now = this.clock.now();
    const policy = await this.policies.execute();
    return this.transactions.run(
      async (tx) => {
        const before = await this.closures.findById(closureId, tx);
        if (!before) throw new AppError(ErrorCode.NOT_FOUND, 'Closure not found.');
        if (!(await this.closures.markRemoved(closureId, staffId, reason, now, tx))) {
          throw new AppError(ErrorCode.VALIDATION_FAILED, 'This closure was already removed.');
        }
        const mealIds = [...(await this.closures.mealIds(before.mealTypes, tx)).values()];
        const affected = await this.closures.bookingsWithStatus(
          before.date,
          mealIds,
          'CANCELLED_BY_CLOSURE',
          tx,
        );
        const context: RestoreContext = { closureId, date: before.date, now, policy, tx };
        let restored = 0;
        for (const booking of affected)
          if ((await this.restore(booking, context)) === 'RESTORED') restored += 1;
        await this.audit.write(tx, {
          action: 'closure.remove',
          entityType: 'mess_closure',
          entityId: closureId,
          before: { status: 'ACTIVE', date: before.date, mealTypes: before.mealTypes },
          after: {
            status: 'REMOVED',
            restoredBookings: restored,
            notRestored: affected.length - restored,
          },
          reason,
        });
        const closure = await this.closures.findById(closureId, tx);
        if (!closure) throw new AppError(ErrorCode.NOT_FOUND, 'Closure not found.');
        return { closure, cancelled: 0, restored, notRestored: affected.length - restored };
      },
      { timeoutMs: 60_000 },
    );
  }

  private async restore(affected: AffectedBooking, context: RestoreContext): Promise<Outcome> {
    const booking = await this.bookings.findBooking(affected.id, context.tx);
    if (
      !booking ||
      isDeadlinePassed(toInstant(context.date, booking.slot.startMinute), context.now)
    )
      return 'NOT_RESTORED';
    const day = await this.bookings.loadStudentDay(affected.studentId, context.date, context.tx);
    const meal = day.meals.find((candidate) => candidate.mealId === affected.mealId);
    if (!meal) return 'NOT_RESTORED';
    const { resolution } = resolveMeal(meal, day, context.date);
    if (resolution.kind !== 'BOOK') {
      await this.tell(affected, meal, context, 'you can book again', 'reopened');
      return 'NOT_RESTORED';
    }
    const slotId = await this.findSeat(resolution.slotId, meal, context);
    if (!slotId) {
      await this.tell(
        affected,
        meal,
        context,
        'your usual slot is now full, so please pick another slot',
        'full',
      );
      return 'NOT_RESTORED';
    }
    const write = {
      status: 'BOOKED' as const,
      slotId: slotId.id,
      isOverCapacity: slotId.isOverCapacity,
      dietType: resolution.dietType,
      source: resolution.source,
      cancelledAt: null,
    };
    if (!(await this.bookings.updateBooking(booking.id, booking.version, write, context.tx)))
      return 'NOT_RESTORED';
    await this.bookings.addEvent(
      {
        bookingId: booking.id,
        type: 'RESTORED_AFTER_CLOSURE',
        fromStatus: 'CANCELLED_BY_CLOSURE',
        toStatus: 'BOOKED',
        payload: { slotId: slotId.id },
        actorType: 'SYSTEM',
        actorStaffId: null,
        reason: null,
      },
      context.tx,
    );
    const label = meal.slots.find((slot) => slot.id === slotId.id)?.label ?? '';
    await this.tell(affected, meal, context, `your booking is restored (${label})`, 'restored');
    return 'RESTORED';
  }

  /** The intended slot, or under AUTO_NEXT_AVAILABLE the first open fallback with a seat (ADR-0006). */
  private async findSeat(
    slotId: string,
    meal: MealDayRow,
    context: RestoreContext,
  ): Promise<{ id: string; isOverCapacity: boolean } | null> {
    const first = await this.seats.tryReserve(slotId, context.date, context.policy, context.tx);
    if (first.isAvailable) return { id: slotId, isOverCapacity: first.isOverCapacity };
    if (context.policy.defaultSlotFullFallback !== 'AUTO_NEXT_AVAILABLE') return null;
    const open = meal.slots.filter(
      (slot) => !isDeadlinePassed(toInstant(context.date, slot.startMinute), context.now),
    );
    for (const candidate of fallbackOrder(
      slotId,
      open.map((slot) => ({ slotId: slot.id, startMinute: slot.startMinute })),
    )) {
      const seat = await this.seats.tryReserve(candidate, context.date, context.policy, context.tx);
      if (seat.isAvailable) return { id: candidate, isOverCapacity: seat.isOverCapacity };
    }
    return null;
  }

  private async tell(
    booking: AffectedBooking,
    meal: MealDayRow,
    context: RestoreContext,
    outcome: string,
    kind: string,
  ): Promise<void> {
    await this.notify.notifyWithin(context.tx, {
      studentIds: [booking.studentId],
      category: 'BOOKING',
      title: `Mess reopened: ${meal.mealName} on ${formatDay(context.date)}`,
      body: `The mess is open for ${meal.mealName.toLowerCase()} after all, and ${outcome}.`,
      relatedEntityType: 'mess_closure',
      relatedEntityId: context.closureId,
      dedupeKey: `closure-removed:${context.closureId}:${meal.mealType}:${kind}`,
    });
  }
}
