// Credentials and hashes never enter the audit log, even inside before/after snapshots.
const SECRET_KEYS = new Set([
  'passwordHash',
  'totpSecretEnc',
  'codeHash',
  'tokenHash',
  'submitterTokenHash',
  'password',
]);

/** JSON-safe copy for audit before/after columns: dates become ISO strings, secrets are dropped. */
export function toAuditSnapshot(value: unknown): unknown {
  if (value === undefined) return undefined;
  return JSON.parse(
    JSON.stringify(value, (key, entry: unknown) => (SECRET_KEYS.has(key) ? undefined : entry)),
  );
}
