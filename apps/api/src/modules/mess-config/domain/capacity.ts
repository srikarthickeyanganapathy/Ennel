export interface CapacitySources {
  defaultCapacity: number;
  weekdayCapacity: number | null;
  overrideCapacity: number | null;
}

/**
 * BR-CAP-1: official capacity for a slot on a date is the per-date override, else the weekday
 * default, else the slot default. Used by booking (Phase 3/4) and capacity impact checks.
 */
export function resolveOfficialCapacity(sources: CapacitySources): number {
  return sources.overrideCapacity ?? sources.weekdayCapacity ?? sources.defaultCapacity;
}
