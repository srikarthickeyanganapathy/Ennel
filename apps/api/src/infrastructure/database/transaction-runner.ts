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

  run<T>(work: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }
}
