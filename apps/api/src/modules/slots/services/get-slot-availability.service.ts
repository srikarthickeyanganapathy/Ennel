import { Injectable } from '@nestjs/common';
import {
  type BusinessDate,
  ErrorCode,
  type MealType,
  type SlotAvailabilityResponse,
  toBusinessDate,
  toMinuteOfDay,
} from '@ennel/shared';
import { AppError } from '../../../common/errors/app-error';
import { Clock } from '../../../infrastructure/clock/clock';
import { GetMessPolicyService } from '../../mess-config/services/get-mess-policy.service';
import {
  computeSlotAvailability,
  isWithinBookingHorizon,
  lastBookableDate,
} from '../domain/slot-availability';
import { SlotAvailabilityRepository } from '../repositories/slot-availability.repository';

/** Slot Selection data for one meal and date (Spec §5, BR-CAP, ADR-0011, ADR-0013). */
@Injectable()
export class GetSlotAvailabilityService {
  constructor(
    private readonly slots: SlotAvailabilityRepository,
    private readonly policies: GetMessPolicyService,
    private readonly clock: Clock,
  ) {}

  async execute(date: BusinessDate, mealType: MealType): Promise<SlotAvailabilityResponse> {
    const now = this.clock.now();
    const today = toBusinessDate(now);
    const policy = await this.policies.execute();
    const lastDate = lastBookableDate(today, policy.bookingHorizonDays);
    if (!isWithinBookingHorizon(date, today, policy.bookingHorizonDays)) {
      throw new AppError(
        ErrorCode.BOOKING_NOT_ALLOWED,
        `Choose a date from today up to ${lastDate}.`,
        { today, lastBookableDate: lastDate },
      );
    }

    const day = await this.slots.loadMealDay(mealType, date);
    if (!day) throw new AppError(ErrorCode.NOT_FOUND, 'This meal is not being served.');

    const isClosed = day.closureTitle !== null;
    return {
      date,
      mealType,
      mealName: day.mealName,
      serviceStartMinute: day.serviceStartMinute,
      serviceEndMinute: day.serviceEndMinute,
      isClosed,
      closureTitle: day.closureTitle,
      allowOverCapacityBooking: policy.allowOverCapacityBooking,
      lastBookableDate: lastDate,
      generatedAt: now.toISOString(),
      slots: computeSlotAvailability(day.slots, {
        date,
        today,
        nowMinute: toMinuteOfDay(now),
        isClosed,
        policy,
      }),
    };
  }
}
