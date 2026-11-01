import { Injectable } from '@nestjs/common';
import {
  type AdminComplaint,
  type ChangeComplaintStatusRequest,
  type ComplaintStatus,
  ErrorCode,
} from '@ennel/shared';
import { AppError } from '../../../../common/errors/app-error';
import { Clock } from '../../../../infrastructure/clock/clock';
import {
  type TransactionClient,
  TransactionRunner,
} from '../../../../infrastructure/database/transaction-runner';
import { isClosedStatus } from '../../../complaints/domain/complaint-rules';
import {
  type ComplaintRow,
  ComplaintsRepository,
} from '../../../complaints/repositories/complaints.repository';
import { GetMessPolicyService } from '../../../mess-config/services/get-mess-policy.service';
import { NotifyStudentsService } from '../../../notifications/services/notify-students.service';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { assertTransition, toAdminComplaint } from './admin-complaints.service';

const STATUS_WORDS: Readonly<Record<ComplaintStatus, string>> = {
  NEW: 'New',
  IN_REVIEW: 'In review',
  RESOLVED: 'Resolved',
  REJECTED: 'Rejected',
};

/** Admin §L writes: status with a reply, assignment and internal notes, each audited. */
@Injectable()
export class AdminComplaintActionsService {
  constructor(
    private readonly complaints: ComplaintsRepository,
    private readonly policies: GetMessPolicyService,
    private readonly notify: NotifyStudentsService,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
    private readonly clock: Clock,
  ) {}

  /** BR-CMP-4: recorded in history; an identified submitter is told (anonymous ones cannot be). */
  changeStatus(
    staffId: string,
    id: string,
    request: ChangeComplaintStatusRequest,
  ): Promise<AdminComplaint> {
    return this.transactions.run(async (tx) => {
      const before = await this.load(id, tx);
      assertTransition(before.status, request.status);
      const now = this.clock.now();
      const response = request.response?.trim() || undefined;
      const isUpdated = await this.complaints.update(
        id,
        request.version,
        {
          status: request.status,
          ...(response && { studentResponse: response }),
          ...(isClosedStatus(request.status) && { resolvedAt: now }),
        },
        tx,
      );
      if (!isUpdated) throw versionConflict();
      await this.complaints.addHistory(
        { complaintId: id, fromStatus: before.status, toStatus: request.status, actorId: staffId },
        tx,
      );
      await this.tellStudent(before, request.status, tx);
      await this.audit.write(tx, {
        action: 'complaint.status.change',
        entityType: 'complaint',
        entityId: id,
        before: { status: before.status, response: before.response },
        after: { status: request.status, response: response ?? before.response },
      });
      return this.view(id, tx);
    });
  }

  assign(
    staffId: string,
    id: string,
    request: { staffId: string | null; version: number },
  ): Promise<AdminComplaint> {
    return this.transactions.run(async (tx) => {
      const before = await this.load(id, tx);
      if (request.staffId && !(await this.isAssignable(request.staffId))) {
        throw new AppError(ErrorCode.VALIDATION_FAILED, 'This person cannot handle complaints.');
      }
      if (
        !(await this.complaints.update(id, request.version, { assignedToId: request.staffId }, tx))
      )
        throw versionConflict();
      await this.audit.write(tx, {
        action: 'complaint.assign',
        entityType: 'complaint',
        entityId: id,
        before: { assignedToId: before.assignedTo?.id ?? null },
        after: { assignedToId: request.staffId, by: staffId },
      });
      return this.view(id, tx);
    });
  }

  /** Internal notes are staff-only (BR-CMP-1); the audit keeps the note ID, not its text. */
  addNote(staffId: string, id: string, body: string): Promise<{ id: string }> {
    return this.transactions.run(async (tx) => {
      await this.load(id, tx);
      const noteId = await this.complaints.addNote(
        { complaintId: id, authorId: staffId, body },
        tx,
      );
      await this.audit.write(tx, {
        action: 'complaint.note.add',
        entityType: 'complaint',
        entityId: id,
        after: { noteId, length: body.length },
      });
      return { id: noteId };
    });
  }

  private async tellStudent(
    complaint: ComplaintRow,
    status: ComplaintStatus,
    tx: TransactionClient,
  ): Promise<void> {
    if (!complaint.studentId) return;
    await this.notify.notifyWithin(tx, {
      studentIds: [complaint.studentId],
      category: 'COMPLAINT',
      title: `Report ${complaint.referenceCode}: ${STATUS_WORDS[status]}`,
      body: isClosedStatus(status)
        ? 'The mess office has replied. Open the report to read it.'
        : 'The mess office is looking into your report.',
      relatedEntityType: 'complaint',
      relatedEntityId: complaint.id,
      dedupeKey: `complaint:${complaint.id}:${status}`,
    });
  }

  private async isAssignable(staffId: string): Promise<boolean> {
    return (await this.complaints.assignees()).some((staff) => staff.id === staffId);
  }

  private async load(id: string, tx: TransactionClient): Promise<ComplaintRow> {
    const row = await this.complaints.find(id, tx);
    if (!row) throw new AppError(ErrorCode.NOT_FOUND, 'This complaint was not found.');
    return row;
  }

  private async view(id: string, tx: TransactionClient): Promise<AdminComplaint> {
    const mode = (await this.policies.execute()).complaintPrivacyMode;
    return toAdminComplaint(await this.load(id, tx), mode);
  }
}

function versionConflict(): AppError {
  return new AppError(
    ErrorCode.VERSION_CONFLICT,
    'A colleague changed this complaint. Reload it and try again.',
  );
}
