import { type RateLimitResult, RateLimiter } from './rate-limiter';

/** Test double: counts per key without expiry. */
export class InMemoryRateLimiter extends RateLimiter {
  private readonly counts = new Map<string, number>();

  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const count = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, count);
    return { isAllowed: count <= limit, retryAfterSeconds: windowSeconds };
  }

  reset(): void {
    this.counts.clear();
  }
}
