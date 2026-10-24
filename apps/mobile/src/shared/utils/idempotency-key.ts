/**
 * A fresh UUID v4 for the Idempotency-Key header (ADR-0016). It only has to be unique for this
 * student, not secret, so Math.random is an acceptable fallback where crypto is unavailable.
 */
export function createIdempotencyKey(): string {
  const random = globalThis.crypto?.randomUUID?.();
  if (random) return random;
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    return (character === 'x' ? value : (value % 4) + 8).toString(16);
  });
}
