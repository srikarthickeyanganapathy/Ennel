import { Injectable } from '@nestjs/common';
import { type Prisma } from '../../generated/prisma/client';
import { PrismaService } from './prisma.service';

/** Transaction-scoped client handed to repositories. */
export type TransactionClient = Prisma.TransactionClient;

/**
 * Runs a multi-write use case in one DB transaction; the audit entry is written with the same
 * client so it commits or rolls back with the change (Admin §P).
 */
@Injectable()
export class TransactionRunner {
  constructor(private readonly prisma: PrismaService) {}

  /** `timeoutMs` raises Prisma's 5-second default for bulk work such as roster imports. */
  run<T>(
    work: (tx: TransactionClient) => Promise<T>,
    options: { timeoutMs?: number } = {},
  ): Promise<T> {
    return options.timeoutMs
      ? this.prisma.$transaction(work, { timeout: options.timeoutMs, maxWait: 10_000 })
      : this.prisma.$transaction(work);
  }
}
