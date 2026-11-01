import { Injectable } from '@nestjs/common';
import {
  type AdminComplaint,
  type AdminComplaintDetail,
  type AdminComplaintList,
  type adminComplaintListQuerySchema,
  type ComplaintAnalytics,
  type ComplaintPrivacyMode,
  type ComplaintStatus,
  ErrorCode,
} from '@ennel/shared';
import { type z } from 'zod';
import { AppError } from '../../../../common/errors/app-error';
import { Clock } from '../../../../infrastructure/clock/clock';
import { FileUrlSigner } from '../../../../infrastructure/storage/file-url-signer';
import { GetMessPolicyService } from '../../../mess-config/services/get-mess-policy.service';
import { canChangeStatus, isClosedStatus } from '../../../complaints/domain/complaint-rules';
import {
  type ComplaintRow,
  ComplaintsRepository,
} from '../../../complaints/repositories/complaints.repository';

type ListQuery = z.output<typeof adminComplaintListQuerySchema>;

/** Admin §L inbox reads: list, detail with signed photo links and notes, analytics. */
@Injectable()
export class AdminComplaintsService {
  constructor(
    private readonly complaints: ComplaintsRepository,
    private readonly policies: GetMessPolicyService,
    private readonly signer: FileUrlSigner,
    private readonly clock: Clock,
  ) {}

  async list(staffId: string, query: ListQuery): Promise<AdminComplaintList> {
    const [{ rows, total }, mode] = await Promise.all([
      this.complaints.list(query, staffId),
      this.currentMode(),
    ]);
    return {
      items: rows.map((row) => toAdminComplaint(row, mode)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async detail(id: string): Promise<AdminComplaintDetail> {
    const row = await this.complaints.find(id);
    if (!row) throw new AppError(ErrorCode.NOT_FOUND, 'This complaint was not found.');
    const [mode, photos, notes, history] = await Promise.all([
      this.currentMode(),
      this.complaints.photos(id),
      this.complaints.notes(id),
      this.complaints.history(id),
    ]);
    const now = this.clock.now();
    return {
      ...toAdminComplaint(row, mode),
      photos: photos.map((photo) => ({
        id: photo.id,
        url: this.signer.createUrl(photo.storageKey, now),
      })),
      notes: notes.map((note) => ({ ...note, createdAt: note.createdAt.toISOString() })),
      history: history.map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() })),
    };
  }

  async analytics(from: string, to: string): Promise<ComplaintAnalytics> {
    if (from > to) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        'The start date must be before the end date.',
      );
    }
    const result = await this.complaints.analytics(from, to);
    const total = result.byStatus.reduce((sum, row) => sum + row.count, 0);
    return {
      total,
      byCategory: result.byCategory.sort((a, b) => b.count - a.count),
      byMeal: result.byMeal.sort((a, b) => b.count - a.count),
      byStatus: result.byStatus,
      averageResolutionHours: averageHours(result.closed),
    };
  }

  async assignees(): Promise<{ items: { id: string; fullName: string }[] }> {
    return { items: await this.complaints.assignees() };
  }

  private async currentMode(): Promise<ComplaintPrivacyMode> {
    return (await this.policies.execute()).complaintPrivacyMode;
  }
}

/**
 * Identity is shown only when the report was identified and the mess still runs in identified
 * mode: switching to anonymous also hides earlier submitters (Admin §L, ADR-0028).
 */
export function toAdminComplaint(row: ComplaintRow, mode: ComplaintPrivacyMode): AdminComplaint {
  const showIdentity = row.privacyMode === 'PRIVATE_IDENTIFIED' && mode === 'PRIVATE_IDENTIFIED';
  return {
    id: row.id,
    referenceCode: row.referenceCode,
    type: row.type,
    category: row.category,
    mealType: row.mealType,
    mealDate: row.mealDate,
    description: row.description,
    status: row.status,
    response: row.response,
    privacyMode: row.privacyMode,
    submitter: showIdentity ? row.submitter : null,
    assignedTo: row.assignedTo,
    photoCount: row.photoCount,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  };
}

function averageHours(closed: { createdAt: Date; resolvedAt: Date | null }[]): number | null {
  const durations = closed.flatMap((row) =>
    row.resolvedAt ? [row.resolvedAt.getTime() - row.createdAt.getTime()] : [],
  );
  if (durations.length === 0) return null;
  const hours = durations.reduce((sum, ms) => sum + ms, 0) / durations.length / 3_600_000;
  return Math.round(hours * 10) / 10;
}

export function assertTransition(from: ComplaintStatus, to: ComplaintStatus): void {
  if (canChangeStatus(from, to)) return;
  const message = isClosedStatus(from)
    ? 'This complaint is already closed.'
    : from === to
      ? 'This complaint already has that status.'
      : 'Move the complaint to In review first.';
  throw new AppError(ErrorCode.VALIDATION_FAILED, message);
}
