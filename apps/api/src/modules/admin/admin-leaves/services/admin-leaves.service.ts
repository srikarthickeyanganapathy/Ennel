import { Injectable } from '@nestjs/common';
import {
  type AdminLeave,
  type AdminLeaveList,
  type adminLeaveListQuerySchema,
  type AdminLeaveResult,
  type CorrectLeaveRequest,
  type CreateStaffLeaveRequest,
  type LeaveCalendar,
  ErrorCode,
  type StaffEndLeaveRequest,
  toBusinessDate,
} from '@ennel/shared';
import { type z } from 'zod';
import { AppError } from '../../../../common/errors/app-error';
import { Clock } from '../../../../infrastructure/clock/clock';
import {
  type TransactionClient,
  TransactionRunner,
} from '../../../../infrastructure/database/transaction-runner';
import { GetMessPolicyService } from '../../../mess-config/services/get-mess-policy.service';
import {
  LeaveCommandsService,
  type LeaveOutcome,
} from '../../../leaves/services/leave-commands.service';
import { LeaveTimelineService } from '../../../leaves/services/leave-timeline.service';
import { toLeave } from '../../../leaves/services/leave-views';
import { AuditWriter } from '../../audit-log/services/audit-writer.service';
import { dailyLeaveCounts, monthBounds } from '../domain/leave-calendar';
import { type AdminLeaveRow, AdminLeavesRepository } from '../repositories/admin-leaves.repository';

type ListQuery = z.output<typeof adminLeaveListQuerySchema>;
const LEAVE_TIMEOUT_MS = 30_000;

/**
 * Admin §K: the leave list, the approval queue and changes on a student's behalf. Every change
 * is audited in the same transaction; changes on behalf are overrides with a reason (ADR-0026).
 */
@Injectable()
export class AdminLeavesService {
  constructor(
    private readonly leaves: AdminLeavesRepository,
    private readonly commands: LeaveCommandsService,
    private readonly timelines: LeaveTimelineService,
    private readonly policies: GetMessPolicyService,
    private readonly transactions: TransactionRunner,
    private readonly audit: AuditWriter,
    private readonly clock: Clock,
  ) {}

  /** Students away per day of a month (Admin §K calendar; also what the forecast removes). */
  async calendar(month: string): Promise<LeaveCalendar> {
    const { first, last } = monthBounds(month);
    const leaves = await this.leaves.approvedBetween(first, last);
    return { month, days: dailyLeaveCounts(leaves, first, last) };
  }

  async list(query: ListQuery): Promise<AdminLeaveList> {
    const today = toBusinessDate(this.clock.now());
    const [{ rows, total }, pendingCount, policy] = await Promise.all([
      this.leaves.list(query, today),
      this.leaves.countPending(),
      this.policies.execute(),
    ]);
    const items: AdminLeave[] = [];
    for (const row of rows) items.push(await this.view(row));
    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      pendingCount,
      requiresApproval: policy.leaveRequiresApproval,
    };
  }

  approve(staffId: string, id: string, version: number): Promise<AdminLeaveResult> {
    return this.change(id, 'leave.approve', null, false, (tx) =>
      this.commands.approve(id, version, staff(staffId, null), tx),
    );
  }

  reject(staffId: string, id: string, version: number, reason: string): Promise<AdminLeaveResult> {
    return this.change(id, 'leave.reject', reason, false, (tx) =>
      this.commands.reject(id, version, staff(staffId, reason), tx),
    );
  }

  async create(staffId: string, request: CreateStaffLeaveRequest): Promise<AdminLeaveResult> {
    if (!(await this.leaves.studentExists(request.studentId))) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Student not found.');
    }
    const { studentId, reason, ...range } = request;
    return this.transactions.run(
      async (tx) => {
        const outcome = await this.commands.create(
          { studentId, range, reason, requiresApproval: false },
          staff(staffId, reason),
          tx,
        );
        return this.finish(outcome, 'leave.create', null, reason, true, tx);
      },
      { timeoutMs: LEAVE_TIMEOUT_MS },
    );
  }

  end(staffId: string, id: string, request: StaffEndLeaveRequest): Promise<AdminLeaveResult> {
    return this.change(id, 'leave.end', request.reason, true, (tx) =>
      this.commands.end(
        id,
        { date: request.resumeDate, mealType: request.resumeMealType },
        request.version,
        staff(staffId, request.reason),
        tx,
      ),
    );
  }

  correct(staffId: string, id: string, request: CorrectLeaveRequest): Promise<AdminLeaveResult> {
    const { version, reason, ...range } = request;
    return this.change(id, 'leave.correct', reason, true, (tx) =>
      this.commands.correct(id, range, version, staff(staffId, reason), tx),
    );
  }

  /** Runs a command on an existing leave and audits it with the before and after state. */
  private async change(
    id: string,
    action: string,
    reason: string | null,
    isOverride: boolean,
    command: (tx: TransactionClient) => Promise<LeaveOutcome>,
  ): Promise<AdminLeaveResult> {
    const before = await this.leaves.find(id);
    if (!before) throw new AppError(ErrorCode.NOT_FOUND, 'This leave was not found.');
    return this.transactions.run(
      async (tx) => this.finish(await command(tx), action, before, reason, isOverride, tx),
      { timeoutMs: LEAVE_TIMEOUT_MS },
    );
  }

  private async finish(
    outcome: LeaveOutcome,
    action: string,
    before: AdminLeaveRow | null,
    reason: string | null,
    isOverride: boolean,
    tx: TransactionClient,
  ): Promise<AdminLeaveResult> {
    const after = await this.leaves.find(outcome.leaveId, tx);
    if (!after) throw new AppError(ErrorCode.NOT_FOUND, 'This leave was not found.');
    await this.audit.write(tx, {
      action,
      entityType: 'leave',
      entityId: outcome.leaveId,
      before: before && snapshot(before),
      after: {
        ...snapshot(after),
        bookingsPaused: outcome.bookingsPaused,
        bookingsResumed: outcome.bookingsResumed,
      },
      reason,
      isOverride,
    });
    return {
      leave: await this.view(after, tx),
      bookingsPaused: outcome.bookingsPaused,
      bookingsResumed: outcome.bookingsResumed,
    };
  }

  private async view(row: AdminLeaveRow, tx?: TransactionClient): Promise<AdminLeave> {
    const timeline = await this.timelines.build(row.studentId, 'STAFF', tx);
    return {
      ...toLeave(row, timeline.current),
      student: row.student,
      decidedByName: row.decidedByName,
    };
  }
}

function staff(staffId: string, reason: string | null) {
  return { type: 'STAFF' as const, staffId, reason };
}

function snapshot(row: AdminLeaveRow) {
  return { status: row.status, ...row.range, studentId: row.studentId };
}
