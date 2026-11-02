import { type BusinessDate, DietType, type ForecastMealDay, toInstant } from '@ennel/shared';
import { type ShowUpEstimate, expectedPlates } from './show-up-rate';

export interface ForecastSlot {
  slotId: string;
  label: string;
  startMinute: number;
}

export interface SeatCount {
  slotId: string;
  dietType: DietType;
  count: number;
}

export interface ForecastMealInput {
  date: BusinessDate;
  mealType: ForecastMealDay['mealType'];
  mealName: string;
  closureTitle: string | null;
  slots: readonly ForecastSlot[];
  seats: readonly SeatCount[];
  estimate: ShowUpEstimate;
  cancellationCutoffMinutes: number;
  now: Date;
}

type Plates = ForecastMealDay['veg'];

function addPlates(plates: Plates[]): Plates {
  return {
    booked: plates.reduce((sum, item) => sum + item.booked, 0),
    expected: plates.reduce((sum, item) => sum + item.expected, 0),
  };
}

/**
 * Admin §N, BR-FC-1: booked and expected plates for one meal on one date, per slot and diet. The
 * meal locks once its last slot's cancel deadline passes (BR-RPT-1): before that, cancellations
 * can still lower the booked count.
 */
export function forecastMealDay(input: ForecastMealInput): ForecastMealDay {
  const plates = (slotId: string, dietType: DietType): Plates => {
    const booked = input.seats
      .filter((seat) => seat.slotId === slotId && seat.dietType === dietType)
      .reduce((sum, seat) => sum + seat.count, 0);
    return { booked, expected: expectedPlates(booked, input.estimate) };
  };
  const slots = input.slots.map((slot) => ({
    slotId: slot.slotId,
    label: slot.label,
    veg: plates(slot.slotId, DietType.VEG),
    nonVeg: plates(slot.slotId, DietType.NON_VEG),
  }));
  const lastStart = Math.max(...input.slots.map((slot) => slot.startMinute), 0);
  const deadline =
    toInstant(input.date, lastStart).getTime() - input.cancellationCutoffMinutes * 60_000;
  return {
    date: input.date,
    mealType: input.mealType,
    mealName: input.mealName,
    closureTitle: input.closureTitle,
    isLocked: input.now.getTime() >= deadline,
    showUpRatePct: Math.round(input.estimate.rate * 100),
    daysUsed: input.estimate.daysUsed,
    isLowConfidence: input.estimate.isLowConfidence,
    veg: addPlates(slots.map((slot) => slot.veg)),
    nonVeg: addPlates(slots.map((slot) => slot.nonVeg)),
    slots,
  };
}

/** Plates booked but not attended (ADR-0029): only finished days, so never below zero. */
export function wastedPlates(day: { booked: number; served: number }): number {
  return Math.max(0, day.booked - day.served);
}
