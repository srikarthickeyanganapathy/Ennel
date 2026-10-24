import { Injectable } from '@nestjs/common';
import { type Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface JobRunRecord {
  id: string;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  attempt: number;
  startedAt: Date;
}

/** `job_runs`: one row per (job, run key), so a re-run of a finished run is a no-op. */
@Injectable()
export class JobRunsRepository {
  constructor(private readonly prisma: PrismaService) {}

  find(jobName: string, runKey: string): Promise<JobRunRecord | null> {
    return this.prisma.jobRun.findUnique({
      where: { jobName_runKey: { jobName, runKey } },
      select: { id: true, status: true, attempt: true, startedAt: true },
    });
  }

  async start(
    jobName: string,
    runKey: string,
    now: Date,
    previous: JobRunRecord | null,
  ): Promise<string> {
    if (previous) {
      await this.prisma.jobRun.update({
        where: { id: previous.id },
        data: {
          status: 'RUNNING',
          attempt: previous.attempt + 1,
          startedAt: now,
          finishedAt: null,
          error: null,
        },
      });
      return previous.id;
    }
    const created = await this.prisma.jobRun.create({
      data: { jobName, runKey, status: 'RUNNING', startedAt: now },
      select: { id: true },
    });
    return created.id;
  }

  async finish(id: string, now: Date, result: { stats?: object; error?: string }): Promise<void> {
    await this.prisma.jobRun.update({
      where: { id },
      data: {
        status: result.error ? 'FAILED' : 'SUCCEEDED',
        finishedAt: now,
        error: result.error?.slice(0, 2000) ?? null,
        stats: (result.stats ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  /** Students the nightly generation works for (BR-DEF-1). */
  async listEligibleStudentIds(): Promise<string[]> {
    const rows = await this.prisma.student.findMany({
      where: { status: 'ACTIVE', onboardingCompletedAt: { not: null } },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    return rows.map((row) => row.id);
  }
}
