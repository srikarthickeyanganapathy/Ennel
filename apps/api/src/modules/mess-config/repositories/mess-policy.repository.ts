import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { isUniqueViolation } from '../../../infrastructure/database/unique-violation';
import { type MessPolicy } from '../domain/mess-policy';

export abstract class MessPolicyRepository {
  abstract get(): Promise<MessPolicy>;
}

const POLICY_ROW_ID = 1;

@Injectable()
export class PrismaMessPolicyRepository extends MessPolicyRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async get(): Promise<MessPolicy> {
    const row = await this.readOrCreate();
    const { id: _id, updatedById: _updatedById, updatedAt: _updatedAt, ...policy } = row;
    return policy;
  }

  // The seed creates the row; creating it here keeps a fresh database usable with schema
  // defaults. Two first reads at once may both try to create it, so the loser reads it instead.
  private async readOrCreate() {
    try {
      return await this.prisma.messPolicy.upsert({
        where: { id: POLICY_ROW_ID },
        create: { id: POLICY_ROW_ID },
        update: {},
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      return this.prisma.messPolicy.findUniqueOrThrow({ where: { id: POLICY_ROW_ID } });
    }
  }
}
