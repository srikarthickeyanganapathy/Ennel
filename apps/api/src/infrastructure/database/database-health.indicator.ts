import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

export abstract class DatabaseHealthIndicator {
  abstract isHealthy(): Promise<boolean>;
}

@Injectable()
export class PrismaDatabaseHealthIndicator extends DatabaseHealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
