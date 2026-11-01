import { Injectable } from '@nestjs/common';
import {
  type Announcement,
  ANNOUNCEMENT_CATEGORIES,
  announcementAudienceSchema,
} from '@ennel/shared';
import { z } from 'zod';
import { type Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';
import { type AnnouncementStatus, type Audience } from '../domain/announcement-rules';

type Category = (typeof ANNOUNCEMENT_CATEGORIES)[number];
type Channel = 'IN_APP' | 'PUSH';

export interface AnnouncementContent {
  title: string;
  body: string;
  category: Category;
  audience: Audience;
  channels: Channel[];
}

export interface StoredAnnouncement extends Omit<Announcement, 'deliveries'> {
  createdById: string;
}

interface Expected {
  statuses: AnnouncementStatus[];
  /** Omitted for the worker, which only checks the status. */
  version?: number;
}

interface StateChange {
  status: AnnouncementStatus;
  scheduledFor?: Date | null;
  sentAt?: Date;
}

const INCLUDE = { createdBy: { select: { fullName: true } } } as const;
type Row = Prisma.AnnouncementGetPayload<{ include: typeof INCLUDE }>;

/** Students who can receive notices: everyone not deactivated (Admin §M). */
const RECEIVING: Prisma.StudentWhereInput = { status: { not: 'DEACTIVATED' } };

/** Announcements, their audience and delivery rows (Admin §M). */
@Injectable()
export class AnnouncementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(content: AnnouncementContent, staffId: string, tx: TransactionClient) {
    const row = await tx.announcement.create({
      data: { ...toData(content), createdById: staffId },
      include: INCLUDE,
    });
    return toStored(row);
  }

  async find(id: string, tx: TransactionClient = this.prisma): Promise<StoredAnnouncement | null> {
    const row = await tx.announcement.findUnique({ where: { id }, include: INCLUDE });
    return row ? toStored(row) : null;
  }

  async list(
    status: AnnouncementStatus | undefined,
    page: { skip: number; take: number },
  ): Promise<{ rows: StoredAnnouncement[]; total: number }> {
    const where = status ? { status } : {};
    const [rows, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...page,
      }),
      this.prisma.announcement.count({ where }),
    ]);
    return { rows: rows.map(toStored), total };
  }

  /** Version- and status-checked edit; false when a colleague changed it or it was sent. */
  updateContent(
    id: string,
    expected: Expected,
    content: AnnouncementContent,
    tx: TransactionClient,
  ): Promise<boolean> {
    return this.write(id, expected, toData(content), tx);
  }

  /** Moves the status on, only from one of the expected statuses (so two senders cannot both win). */
  transition(id: string, expected: Expected, state: StateChange, tx: TransactionClient) {
    return this.write(id, expected, state, tx);
  }

  private async write(
    id: string,
    expected: Expected,
    data: Prisma.AnnouncementUpdateManyMutationInput,
    tx: TransactionClient,
  ): Promise<boolean> {
    const result = await tx.announcement.updateMany({
      where: {
        id,
        status: { in: expected.statuses },
        ...(expected.version !== undefined && { version: expected.version }),
      },
      data: { ...data, version: { increment: 1 } },
    });
    return result.count === 1;
  }

  /** Scheduled announcements whose time has come. */
  async dueIds(now: Date): Promise<string[]> {
    const rows = await this.prisma.announcement.findMany({
      where: { status: 'SCHEDULED', scheduledFor: { lte: now } },
      select: { id: true },
      orderBy: { scheduledFor: 'asc' },
      take: 20,
    });
    return rows.map((row) => row.id);
  }

  /**
   * Sent in-app before `sentBefore` but with pushes still pending (e.g. the process stopped
   * mid-send). The age check leaves a send that is still running alone.
   */
  async sendingIds(sentBefore: Date): Promise<string[]> {
    const rows = await this.prisma.announcement.findMany({
      where: { status: 'SENDING', sentAt: { lte: sentBefore } },
      select: { id: true },
      take: 20,
    });
    return rows.map((row) => row.id);
  }

  async resolveAudience(audience: Audience): Promise<{
    studentIds: string[];
    unknownReferenceNumbers: string[];
  }> {
    const rows = await this.prisma.student.findMany({
      where: { ...RECEIVING, ...audienceWhere(audience) },
      select: { id: true, rosterEntry: { select: { referenceNumber: true } } },
    });
    const found = new Set(rows.map((row) => row.rosterEntry.referenceNumber));
    return {
      studentIds: rows.map((row) => row.id),
      unknownReferenceNumbers: audience.referenceNumbers.filter((ref) => !found.has(ref)),
    };
  }

  async createDeliveries(
    announcementId: string,
    studentIds: readonly string[],
    channels: readonly Channel[],
    now: Date,
    tx: TransactionClient,
  ): Promise<void> {
    const data = channels.flatMap((channel) =>
      studentIds.map((studentId) => ({
        announcementId,
        studentId,
        channel,
        // The in-app notice is written in the same transaction, so it is delivered on commit.
        status: channel === 'IN_APP' ? ('DELIVERED' as const) : ('PENDING' as const),
        deliveredAt: channel === 'IN_APP' ? now : null,
      })),
    );
    await tx.announcementDelivery.createMany({ data, skipDuplicates: true });
  }

  async pendingPushStudentIds(announcementId: string): Promise<string[]> {
    const rows = await this.prisma.announcementDelivery.findMany({
      where: { announcementId, channel: 'PUSH', status: 'PENDING' },
      select: { studentId: true },
    });
    return rows.map((row) => row.studentId);
  }

  async recordPush(
    announcementId: string,
    outcome: { delivered: readonly string[]; failed: readonly string[] },
    now: Date,
    tx: TransactionClient,
  ): Promise<void> {
    const where = { announcementId, channel: 'PUSH' as const, status: 'PENDING' as const };
    await tx.announcementDelivery.updateMany({
      where: { ...where, studentId: { in: [...outcome.delivered] } },
      data: { status: 'DELIVERED', deliveredAt: now },
    });
    await tx.announcementDelivery.updateMany({
      where: { ...where, studentId: { in: [...outcome.failed] } },
      data: { status: 'FAILED', error: 'No device accepted the push' },
    });
  }

  async deliveryCounts(ids: readonly string[]): Promise<Map<string, Announcement['deliveries']>> {
    const counts = new Map<string, Announcement['deliveries']>(
      ids.map((id) => [id, { inApp: 0, pushSent: 0, pushFailed: 0 }]),
    );
    if (ids.length === 0) return counts;
    const groups = await this.prisma.announcementDelivery.groupBy({
      by: ['announcementId', 'channel', 'status'],
      where: { announcementId: { in: [...ids] } },
      _count: { _all: true },
    });
    for (const group of groups) {
      const entry = counts.get(group.announcementId);
      if (!entry) continue;
      const count = group._count._all;
      if (group.channel === 'IN_APP' && group.status === 'DELIVERED') entry.inApp += count;
      if (group.channel === 'PUSH' && group.status === 'DELIVERED') entry.pushSent += count;
      if (group.channel === 'PUSH' && group.status === 'FAILED') entry.pushFailed += count;
    }
    return counts;
  }
}

function audienceWhere(audience: Audience): Prisma.StudentWhereInput {
  switch (audience.type) {
    case 'ALL':
      return {};
    case 'HOSTEL':
      return { hostelBlock: { hostelId: { in: audience.hostelIds } } };
    case 'BLOCK':
      return { hostelBlockId: { in: audience.blockIds } };
    case 'ACADEMIC_YEAR':
      return { academicYear: { in: audience.academicYears } };
    case 'CUSTOM':
      return { rosterEntry: { referenceNumber: { in: audience.referenceNumbers } } };
  }
}

function toData(content: AnnouncementContent) {
  const { audience, ...rest } = content;
  const { type, ...filter } = audience;
  return { ...rest, audienceType: type, audienceFilter: filter };
}

/** The JSON column is read back through the shared schema rather than trusted as typed. */
const storedFilterSchema = announcementAudienceSchema.omit({ type: true });
const categorySchema = z.enum(ANNOUNCEMENT_CATEGORIES).catch('GENERAL');

function toStored(row: Row): StoredAnnouncement {
  const filter = storedFilterSchema.parse(row.audienceFilter ?? {});
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    category: categorySchema.parse(row.category),
    audience: { type: row.audienceType, ...filter },
    channels: row.channels,
    status: row.status,
    scheduledFor: row.scheduledFor?.toISOString() ?? null,
    sentAt: row.sentAt?.toISOString() ?? null,
    createdByName: row.createdBy.fullName,
    createdById: row.createdById,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
  };
}
