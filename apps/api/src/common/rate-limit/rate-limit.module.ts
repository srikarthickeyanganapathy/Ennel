import { Global, Module } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimiter } from './rate-limiter';
import { RedisRateLimiter } from './redis-rate-limiter';

@Global()
@Module({
  providers: [{ provide: RateLimiter, useClass: RedisRateLimiter }, RateLimitGuard],
  exports: [RateLimiter, RateLimitGuard],
})
export class RateLimitModule {}
