import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
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
    // The seed creates the row; upsert keeps a fresh database usable with schema defaults.
    const row = await this.prisma.messPolicy.upsert({
      where: { id: POLICY_ROW_ID },
      create: { id: POLICY_ROW_ID },
      update: {},
    });
    const { id: _id, updatedById: _updatedById, updatedAt: _updatedAt, ...policy } = row;
    return policy;
  }
}
