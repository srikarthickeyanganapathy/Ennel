const REDACTED = '[REDACTED]';

// Secrets and personal data must never reach logs (CLAUDE.md coding standards).
const SENSITIVE_KEY =
  /pass(word)?|secret|token|authorization|cookie|totp|otp|resetcode|phone|email|referencenumber|fullname/i;
const MAX_DEPTH = 6;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[TRUNCATED]';
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Error) return { name: value.name, message: value.message };

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(entry, depth + 1);
  }
  return result;
}
