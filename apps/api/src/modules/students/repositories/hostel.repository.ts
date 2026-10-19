import { Injectable } from '@nestjs/common';
import { type HostelOption } from '@ennel/shared';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export abstract class HostelRepository {
  abstract listActive(): Promise<HostelOption[]>;
}

@Injectable()
export class PrismaHostelRepository extends HostelRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  listActive(): Promise<HostelOption[]> {
    return this.prisma.hostel.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        blocks: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        },
      },
    });
  }
}
