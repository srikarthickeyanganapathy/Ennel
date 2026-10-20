export interface PolicyIssue {
  path: string;
  message: string;
}

interface CrossFieldPolicy {
  noShowWarningThreshold: number;
  noShowDisableThreshold: number;
  fillingFastThresholdPct: number;
  recommendedMaxOccupancyPct: number;
}

/**
 * Cross-field checks from ADR-0009 and ADR-0013; single-field ranges are in the shared schema.
 * Checked against the merged policy, so a partial update cannot break the combination.
 */
export function findPolicyProblems(policy: CrossFieldPolicy): PolicyIssue[] {
  const issues: PolicyIssue[] = [];
  if (policy.noShowWarningThreshold >= policy.noShowDisableThreshold) {
    issues.push({
      path: 'noShowWarningThreshold',
      message: 'The warning must come before Default Booking is switched off',
    });
  }
  if (policy.recommendedMaxOccupancyPct >= policy.fillingFastThresholdPct) {
    issues.push({
      path: 'recommendedMaxOccupancyPct',
      message: '"Recommended" must be below the "Filling Fast" level',
    });
  }
  return issues;
}

/** Only the fields whose values actually change, for history and audit before/after. */
export function diffPolicy<T extends object>(
  before: T,
  changes: Partial<T>,
): { before: Partial<T>; after: Partial<T> } {
  const keys = (Object.keys(changes) as (keyof T)[]).filter(
    (key) =>
      changes[key] !== undefined && JSON.stringify(changes[key]) !== JSON.stringify(before[key]),
  );
  return {
    before: Object.fromEntries(keys.map((key) => [key, before[key]])) as Partial<T>,
    after: Object.fromEntries(keys.map((key) => [key, changes[key]])) as Partial<T>,
  };
}
