import { Injectable } from '@nestjs/common';
import { type Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';

export interface StoredResponse {
  route: string;
  requestHash: string;
  responseBody: unknown;
  createdAt: Date;
}

export interface NewStoredResponse {
  actorKey: string;
  key: string;
  route: string;
  requestHash: string;
  responseCode: number;
  responseBody: unknown;
}

export abstract class IdempotencyRepository {
  abstract find(actorKey: string, key: string): Promise<StoredResponse | null>;
  abstract save(record: NewStoredResponse, tx: TransactionClient): Promise<void>;
  abstract deleteExpired(actorKey: string, key: string, before: Date): Promise<void>;
}

@Injectable()
export class PrismaIdempotencyRepository extends IdempotencyRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  find(actorKey: string, key: string): Promise<StoredResponse | null> {
    return this.prisma.idempotencyKey.findUnique({
      where: { actorKey_key: { actorKey, key } },
      select: { route: true, requestHash: true, responseBody: true, createdAt: true },
    });
  }

  async save(record: NewStoredResponse, tx: TransactionClient): Promise<void> {
    await tx.idempotencyKey.create({
      data: { ...record, responseBody: record.responseBody as Prisma.InputJsonValue },
    });
  }

  async deleteExpired(actorKey: string, key: string, before: Date): Promise<void> {
    await this.prisma.idempotencyKey.deleteMany({
      where: { actorKey, key, createdAt: { lt: before } },
    });
  }
}
