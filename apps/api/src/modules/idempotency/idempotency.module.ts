import { Global, Module } from '@nestjs/common';
import {
  IdempotencyRepository,
  PrismaIdempotencyRepository,
} from './repositories/idempotency.repository';
import { IdempotencyService } from './services/idempotency.service';

/** Rule 13, ADR-0016: shared by booking now, and leave and complaint submissions later. */
@Global()
@Module({
  providers: [
    { provide: IdempotencyRepository, useClass: PrismaIdempotencyRepository },
    IdempotencyService,
  ],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
