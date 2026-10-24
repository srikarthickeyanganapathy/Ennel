import { Injectable } from '@nestjs/common';
import {
  type AppliedRule,
  BookingStatus,
  type BusinessDate,
  type DayResponse,
  type MealCard,
  type MealType,
  toBusinessDate,
} from '@ennel/shared';
import { Clock } from '../../../infrastructure/clock/clock';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';
import { type MessPolicy } from '../../mess-config/domain/mess-policy';
import { GetMessPolicyService } from '../../mess-config/services/get-mess-policy.service';
import { isWithinBookingHorizon, lastBookableDate } from '../../slots/domain/slot-availability';
import { isMealCoveredByLeave } from '../domain/leave-coverage';
import { deriveBookingLabel, mealActions } from '../domain/meal-card-rules';
import {
  type DefaultIntent,
  defaultChoice,
  resolveEffectiveBooking,
  resolveRecurring,
} from '../domain/resolve-effective-booking';
import {
  type BookingRow,
  BookingsRepository,
  type MealDayRow,
  type StudentDay,
} from '../repositories/bookings.repository';
import { notAllowed } from './booking-errors';

interface CardContext {
  now: Date;
  date: BusinessDate;
  day: StudentDay;
  policy: MessPolicy;
}

/** The Home page's three meal cards for one date (Spec §4.2–4.5, BR-BOOK-3/4, BR-DEAD). */
@Injectable()
export class BookingDayService {
  constructor(
    private readonly bookings: BookingsRepository,
    private readonly policies: GetMessPolicyService,
    private readonly clock: Clock,
  ) {}

  async build(studentId: string, date: BusinessDate, tx?: TransactionClient): Promise<DayResponse> {
    const now = this.clock.now();
    const today = toBusinessDate(now);
    const policy = await this.policies.execute();
    this.assertWithinHorizon(date, today, policy.bookingHorizonDays);
    const day = await this.bookings.loadStudentDay(studentId, date, tx);
    const context: CardContext = { now, date, day, policy };
    return {
      date,
      today,
      lastBookableDate: lastBookableDate(today, policy.bookingHorizonDays),
      generatedAt: now.toISOString(),
      meals: day.meals.map((meal) => toCard(meal, context)),
    };
  }

  async card(
    studentId: string,
    date: BusinessDate,
    mealType: MealType,
    tx?: TransactionClient,
  ): Promise<MealCard> {
    const day = await this.build(studentId, date, tx);
    const card = day.meals.find((meal) => meal.mealType === mealType);
    if (!card) throw notAllowed('This meal is not being served.');
    return card;
  }

  /** ADR-0011: Home shows today up to today + horizon. */
  assertWithinHorizon(date: BusinessDate, today: BusinessDate, horizonDays: number): void {
    if (isWithinBookingHorizon(date, today, horizonDays)) return;
    const last = lastBookableDate(today, horizonDays);
    throw notAllowed(`Choose a date from today up to ${last}.`, { today, lastBookableDate: last });
  }
}

function toCard(meal: MealDayRow, context: CardContext): MealCard {
  const isOnLeave = context.day.leaves.some((leave) =>
    isMealCoveredByLeave(leave, context.date, meal.mealType),
  );
  const isClosed = meal.closureTitle !== null;
  const defaultIntent = toDefaultIntent(meal, context.day.defaultBookingEnabled);
  const resolution = resolveEffectiveBooking({
    isClosed,
    isOnApprovedLeave: isOnLeave,
    dateException: meal.dateException,
    weekdayRule: meal.weekdayRule,
    defaultIntent,
  });
  const recurring = resolveRecurring(meal.weekdayRule, defaultIntent);
  const { booking } = meal;
  return {
    mealType: meal.mealType,
    mealName: meal.mealName,
    date: context.date,
    serviceStartMinute: meal.serviceStartMinute,
    serviceEndMinute: meal.serviceEndMinute,
    label: deriveBookingLabel({
      booking: booking && {
        status: booking.status,
        source: booking.source,
        slotId: booking.slot.id,
        dietType: booking.dietType,
      },
      resolution,
      recurring,
      isDefaultOff: !meal.weekdayRule && !defaultChoice(defaultIntent),
    }),
    appliedRule: booking ? ruleForBooking(booking) : resolution.appliedRule,
    closureTitle: meal.closureTitle,
    booking: booking && toCardBooking(booking),
    actions: mealActions({
      now: context.now,
      date: context.date,
      isClosed,
      isOnLeave,
      isWithinHorizon: true,
      lastSlotStartMinute: meal.slots.at(-1)?.startMinute ?? null,
      booking: booking && { status: booking.status, slotStartMinute: booking.slot.startMinute },
      policy: context.policy,
    }),
  };
}

function toDefaultIntent(meal: MealDayRow, isOverallEnabled: boolean): DefaultIntent {
  return {
    isOverallEnabled,
    isMealEnabled: meal.preference?.isEnabled ?? false,
    isAutoDisabled: meal.preference?.isAutoDisabled ?? false,
    slotId: meal.preference?.slotId ?? undefined,
    dietType: meal.preference?.dietType,
  };
}

/** Which intent the existing booking came from, for the card's explanation (ADR-0014). */
function ruleForBooking(booking: BookingRow): AppliedRule {
  if (booking.status === BookingStatus.CANCELLED_BY_CLOSURE) return 'CLOSURE';
  if (booking.status === BookingStatus.PAUSED_LEAVE) return 'LEAVE';
  if (booking.source === 'DEFAULT') return 'DEFAULT';
  if (booking.source === 'PLAN_AHEAD_WEEKDAY') return 'WEEKDAY_RULE';
  return 'DATE_EXCEPTION';
}

function toCardBooking(booking: BookingRow): NonNullable<MealCard['booking']> {
  return {
    id: booking.id,
    slotId: booking.slot.id,
    slotLabel: booking.slot.label,
    slotStartMinute: booking.slot.startMinute,
    slotEndMinute: booking.slot.endMinute,
    dietType: booking.dietType,
    status: booking.status,
    source: booking.source,
    isOverCapacity: booking.isOverCapacity,
    isUpdatedByStaff: booking.lastActorType === 'STAFF',
    version: booking.version,
  };
}
