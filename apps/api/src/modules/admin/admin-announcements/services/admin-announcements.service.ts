import { Injectable } from '@nestjs/common';
import {
  type Announcement,
  type AnnouncementList,
  type announcementListQuerySchema,
  type AudiencePreview,
  type createAnnouncementRequestSchema,
  ErrorCode,
} from '@ennel/shared';
import { type z } from 'zod';
import { AppError } from '../../../../common/errors/app-error';
import { Clock } from '../../../../infrastructure/clock/clock';
import {
  type TransactionClient,
  TransactionRunner,
} from '../../../../infrastructure/database/transaction-runner';
import {
  type Audience,
  audienceProblem,
  isEditable,
  isScheduleValid,
  normaliseAudience,
} from '../../../announcements/domain/announcement-rules';
import {
  type AnnouncementContent,
  AnnouncementsRepository,
  type StoredAnnouncement,
} from '../../../announcements/repositories/announcements.repository';
import { AnnouncementSender } from '../../../announcements/services/announcement-sender.service';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';

type ListQuery = z.output<typeof announcementListQuerySchema>;
type ContentRequest = z.output<typeof createAnnouncementRequestSchema>;

/** Admin §M: compose, edit before send, schedule, send now, cancel, history. All audited. */
@Injectable()
export class AdminAnnouncementsService {
  constructor(
    private readonly announcements: AnnouncementsRepository,
    private readonly sender: AnnouncementSender,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
    private readonly clock: Clock,
  ) {}

  async list(query: ListQuery): Promise<AnnouncementList> {
    const { rows, total } = await this.announcements.list(query.status, {
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    const counts = await this.announcements.deliveryCounts(rows.map((row) => row.id));
    return {
      items: rows.map((row) => withCounts(row, counts)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string): Promise<Announcement> {
    const row = await this.announcements.find(id);
    if (!row) throw notFound();
    return withCounts(row, await this.announcements.deliveryCounts([id]));
  }

  async preview(audience: Audience): Promise<AudiencePreview> {
    const normalised = checkedAudience(audience);
    const { studentIds, unknownReferenceNumbers } =
      await this.announcements.resolveAudience(normalised);
    return { recipients: studentIds.length, unknownReferenceNumbers };
  }

  create(staffId: string, request: ContentRequest): Promise<Announcement> {
    const content = toContent(request);
    return this.transactions.run(async (tx) => {
      const row = await this.announcements.create(content, staffId, tx);
      await this.audit.write(tx, {
        action: 'announcement.create',
        entityType: 'announcement',
        entityId: row.id,
        after: auditView(row),
      });
      return withCounts(row, new Map());
    });
  }

  update(id: string, request: ContentRequest & { version: number }): Promise<Announcement> {
    const content = toContent(request);
    return this.change(id, 'announcement.update', async (before, tx) => {
      if (!isEditable(before.status)) throw notEditable();
      const expected = { statuses: [before.status], version: request.version };
      return this.announcements.updateContent(id, expected, content, tx);
    });
  }

  schedule(id: string, scheduledFor: string, version: number): Promise<Announcement> {
    const when = new Date(scheduledFor);
    if (!isScheduleValid(when, this.clock.now())) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, 'Choose a time at least a minute from now.');
    }
    return this.change(id, 'announcement.schedule', (before, tx) => {
      if (!isEditable(before.status)) throw notEditable();
      return this.announcements.transition(
        id,
        { statuses: ['DRAFT', 'SCHEDULED'], version },
        { status: 'SCHEDULED', scheduledFor: when },
        tx,
      );
    });
  }

  /** Stops a draft or scheduled announcement for good; it stays in the history. */
  cancel(id: string, version: number): Promise<Announcement> {
    return this.change(id, 'announcement.cancel', (before, tx) => {
      if (!isEditable(before.status)) throw notEditable();
      return this.announcements.transition(
        id,
        { statuses: ['DRAFT', 'SCHEDULED'], version },
        { status: 'CANCELLED', scheduledFor: null },
        tx,
      );
    });
  }

  async sendNow(id: string, version: number): Promise<Announcement> {
    const before = await this.announcements.find(id);
    if (!before) throw notFound();
    if (!isEditable(before.status)) throw notEditable();
    const isSent = await this.sender.send(id, { from: ['DRAFT', 'SCHEDULED'], version });
    if (!isSent) throw versionConflict();
    return this.get(id);
  }

  /** Shared shape of a version-checked, audited change. */
  private async change(
    id: string,
    action: string,
    apply: (before: StoredAnnouncement, tx: TransactionClient) => Promise<boolean>,
  ): Promise<Announcement> {
    return this.transactions.run(async (tx) => {
      const before = await this.announcements.find(id, tx);
      if (!before) throw notFound();
      if (!(await apply(before, tx))) throw versionConflict();
      const after = await this.announcements.find(id, tx);
      if (!after) throw notFound();
      await this.audit.write(tx, {
        action,
        entityType: 'announcement',
        entityId: id,
        before: auditView(before),
        after: auditView(after),
      });
      return withCounts(after, await this.announcements.deliveryCounts([id]));
    });
  }
}

function toContent(request: ContentRequest): AnnouncementContent {
  return {
    title: request.title,
    body: request.body,
    category: request.category,
    audience: checkedAudience(request.audience),
    channels: [...new Set(request.channels)],
  };
}

function checkedAudience(audience: Audience): Audience {
  const normalised = normaliseAudience(audience);
  const problem = audienceProblem(normalised);
  if (problem) throw new AppError(ErrorCode.VALIDATION_FAILED, problem);
  return normalised;
}

/** Audit snapshots leave out custom reference lists, which identify students. */
function auditView(row: StoredAnnouncement) {
  const { referenceNumbers, ...audience } = row.audience;
  return {
    title: row.title,
    category: row.category,
    audience: { ...audience, referenceCount: referenceNumbers.length },
    channels: row.channels,
    status: row.status,
    scheduledFor: row.scheduledFor,
  };
}

function withCounts(
  row: StoredAnnouncement,
  counts: Map<string, Announcement['deliveries']>,
): Announcement {
  const { createdById: _createdById, ...announcement } = row;
  return {
    ...announcement,
    deliveries: counts.get(row.id) ?? { inApp: 0, pushSent: 0, pushFailed: 0 },
  };
}

const notFound = () => new AppError(ErrorCode.NOT_FOUND, 'This announcement was not found.');
const notEditable = () =>
  new AppError(
    ErrorCode.VALIDATION_FAILED,
    'This announcement has already been sent or cancelled.',
  );
const versionConflict = () =>
  new AppError(
    ErrorCode.VERSION_CONFLICT,
    'A colleague changed this announcement. Reload it and try again.',
  );
