export interface RateLimitResult {
  isAllowed: boolean;
  retryAfterSeconds: number;
}

/** Fixed-window counter keyed per client (Rule 11 login rate limiting). */
export abstract class RateLimiter {
  abstract consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
}
