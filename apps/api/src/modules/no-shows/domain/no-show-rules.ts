import {
  addBusinessDays,
  type BusinessDate,
  type NoShowLevel,
  type NoShowStatus,
} from '@ennel/shared';

export interface NoShowPolicy {
  noShowWindowDays: number;
  noShowWarningThreshold: number;
  noShowDisableThreshold: number;
}

export interface CountableEvent {
  date: BusinessDate;
  status: NoShowStatus;
}

/** BR-NS-3: the rolling window ends today, e.g. 30 days = today and the 29 days before. */
export function windowStart(today: BusinessDate, policy: NoShowPolicy): BusinessDate {
  return addBusinessDays(today, -(policy.noShowWindowDays - 1));
}

/** BR-NS-2/3: only COUNTED events inside the window count; held, excluded and older ones do not. */
export function countInWindow(
  events: readonly CountableEvent[],
  today: BusinessDate,
  policy: NoShowPolicy,
): number {
  const start = windowStart(today, policy);
  return events.filter(
    (event) => event.status === 'COUNTED' && event.date >= start && event.date <= today,
  ).length;
}

/** Spec §10: warning from the warning threshold, disabled at the disable threshold. */
export function levelFor(count: number, policy: NoShowPolicy): NoShowLevel {
  if (count >= policy.noShowDisableThreshold) return 'DISABLED';
  return count >= policy.noShowWarningThreshold ? 'WARNING' : 'NONE';
}

export function remainingBeforeDisable(count: number, policy: NoShowPolicy): number {
  return Math.max(0, policy.noShowDisableThreshold - count);
}

/** BR-NS-5: disable once the threshold is reached, unless it is already off. */
export function shouldAutoDisable(count: number, policy: NoShowPolicy, isAutoDisabled: boolean) {
  return !isAutoDisabled && count >= policy.noShowDisableThreshold;
}

/** BR-NS-6 (ADR-0009): the student may switch it back on once the count is below the threshold. */
export function canReEnable(count: number, policy: NoShowPolicy, isAutoDisabled: boolean) {
  return isAutoDisabled && count < policy.noShowDisableThreshold;
}

/** ADR-0027: warn once when the count first reaches the warning level (the disable has its own notice). */
export function crossesWarning(before: number, after: number, policy: NoShowPolicy): boolean {
  return (
    before < policy.noShowWarningThreshold &&
    after >= policy.noShowWarningThreshold &&
    after < policy.noShowDisableThreshold
  );
}

/** ADR-0027: one report per event, for events that still count or wait for review, in the window. */
export function canAppeal(
  event: CountableEvent,
  hasAppeal: boolean,
  today: BusinessDate,
  policy: NoShowPolicy,
): boolean {
  if (hasAppeal || event.status === 'EXCLUDED') return false;
  return event.date >= windowStart(today, policy);
}
