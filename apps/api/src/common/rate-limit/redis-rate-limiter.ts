import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../infrastructure/redis/redis.module';
import { type RateLimitResult, RateLimiter } from './rate-limiter';

@Injectable()
export class RedisRateLimiter extends RateLimiter {
  private readonly logger = new Logger(RedisRateLimiter.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    super();
  }

  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const redisKey = `rate-limit:${key}`;
    try {
      const [[, count], [, ttl]] = (await this.redis
        .multi()
        .incr(redisKey)
        .ttl(redisKey)
        .exec()) as [[null, number], [null, number]];
      if (ttl < 0) await this.redis.expire(redisKey, windowSeconds);
      const retryAfterSeconds = ttl > 0 ? ttl : windowSeconds;
      return { isAllowed: count <= limit, retryAfterSeconds };
    } catch (error) {
      // Fail open: an unavailable Redis must not lock every student out. Account lockout
      // in the database still applies (BR-AUTH-3).
      this.logger.warn('Rate limiter unavailable; request allowed', error);
      return { isAllowed: true, retryAfterSeconds: 0 };
    }
  }
}
