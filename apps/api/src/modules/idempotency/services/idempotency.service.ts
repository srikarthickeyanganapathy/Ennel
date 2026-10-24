import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@ennel/shared';
import { type ZodType } from 'zod';
import { AppError } from '../../../common/errors/app-error';
import { Clock } from '../../../infrastructure/clock/clock';
import {
  type TransactionClient,
  TransactionRunner,
} from '../../../infrastructure/database/transaction-runner';
import { isUniqueViolation } from '../../../infrastructure/database/unique-violation';
import { IdempotencyRepository, type StoredResponse } from '../repositories/idempotency.repository';

const KEY_LIFETIME_MS = 24 * 60 * 60 * 1000;

export interface IdempotencyContext {
  /** "student:<id>" or "staff:<id>" */
  actorKey: string;
  key: string;
  /** e.g. "POST /bookings" */
  route: string;
  /** What was asked for; the same key with a different request is refused. */
  request: unknown;
}

export interface IdempotentWork<T> {
  context: IdempotencyContext;
  responseCode: number;
  responseSchema: ZodType<T>;
  work: (tx: TransactionClient) => Promise<T>;
}

/**
 * Rule 13, ADR-0016: a retried submission returns the original response instead of acting twice.
 * The response is stored in the same transaction as the change, so neither can exist alone.
 */
@Injectable()
export class IdempotencyService {
  constructor(
    private readonly responses: IdempotencyRepository,
    private readonly transactions: TransactionRunner,
    private readonly clock: Clock,
  ) {}

  async run<T>(job: IdempotentWork<T>): Promise<T> {
    const { context } = job;
    const requestHash = hashRequest(context.route, context.request);
    const replay = await this.findReplay(context, requestHash, job.responseSchema);
    if (replay !== undefined) return replay;
    try {
      return await this.transactions.run(async (tx) => {
        const result = await job.work(tx);
        await this.responses.save(
          { ...pick(context), requestHash, responseCode: job.responseCode, responseBody: result },
          tx,
        );
        return result;
      });
    } catch (error) {
      // A parallel duplicate committed first: answer with its stored response.
      if (!isUniqueViolation(error)) throw error;
      const stored = await this.findReplay(context, requestHash, job.responseSchema);
      if (stored === undefined) throw error;
      return stored;
    }
  }

  private async findReplay<T>(
    context: IdempotencyContext,
    requestHash: string,
    schema: ZodType<T>,
  ): Promise<T | undefined> {
    const stored = await this.responses.find(context.actorKey, context.key);
    if (!stored) return undefined;
    if (this.isExpired(stored)) {
      await this.responses.deleteExpired(context.actorKey, context.key, this.expiryCutoff());
      return undefined;
    }
    if (stored.route !== context.route || stored.requestHash !== requestHash) {
      throw new AppError(
        ErrorCode.IDEMPOTENCY_KEY_REUSED,
        'This request was already sent with different details. Please try again.',
      );
    }
    return schema.parse(stored.responseBody);
  }

  private isExpired(stored: StoredResponse): boolean {
    return stored.createdAt.getTime() < this.expiryCutoff().getTime();
  }

  private expiryCutoff(): Date {
    return new Date(this.clock.now().getTime() - KEY_LIFETIME_MS);
  }
}

function pick(context: IdempotencyContext) {
  return { actorKey: context.actorKey, key: context.key, route: context.route };
}

export function hashRequest(route: string, request: unknown): string {
  return createHash('sha256').update(JSON.stringify({ route, request })).digest('hex');
}
