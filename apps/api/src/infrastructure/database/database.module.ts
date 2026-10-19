import { Global, Module } from '@nestjs/common';
import {
  DatabaseHealthIndicator,
  PrismaDatabaseHealthIndicator,
} from './database-health.indicator';
import { PrismaService } from './prisma.service';
import { TransactionRunner } from './transaction-runner';

@Global()
@Module({
  providers: [
    PrismaService,
    TransactionRunner,
    { provide: DatabaseHealthIndicator, useClass: PrismaDatabaseHealthIndicator },
  ],
  exports: [PrismaService, TransactionRunner, DatabaseHealthIndicator],
})
export class DatabaseModule {}
