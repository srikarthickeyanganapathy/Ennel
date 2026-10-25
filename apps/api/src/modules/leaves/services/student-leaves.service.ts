import { Injectable } from '@nestjs/common';
import {
  type ApplyLeaveRequest,
  countRange,
  type EndLeaveRequest,
  ErrorCode,
  type ExtendLeaveRequest,
  isPointInRange,
  type Leave,
  type LeavePreview,
  type LeaveResult,
  leaveResultSchema,
  type LeavesResponse,
  type MealRange,
  type MealType,
  toInstant,
} from '@ennel/shared';
import { AppError } from '../../../common/errors/app-error';
import {
  type TransactionClient,
  TransactionRunner,
} from '../../../infrastructure/database/transaction-runner';
import { IdempotencyService } from '../../idempotency/services/idempotency.service';
import { checkLeaveRange, currentLeaveStatus } from '../domain/leave-rules';
import { LeavesRepository } from '../repositories/leaves.repository';
import { LeaveCommandsService, type LeaveOutcome } from './leave-commands.service';
import { LeaveTimelineService } from './leave-timeline.service';
import { toLeave } from './leave-views';

const STUDENT = { type: 'STUDENT', staffId: null, reason: null } as const;
/** Bookings re-sync the whole booking period; well above Prisma's 5-second default. */
const LEAVE_TIMEOUT_MS = 30_000;

/** Leave Management for students (Spec §11). */
@Injectable()
export class StudentLeavesService {
  constructor(
    private readonly leaves: LeavesRepository,
    private readonly commands: LeaveCommandsService,
    private readonly timelines: LeaveTimelineService,
    private readonly idempotency: IdempotencyService,
    private readonly transactions: TransactionRunner,
  ) {}

  async list(studentId: string): Promise<LeavesResponse> {
    const timeline = await this.timelines.build(studentId, 'STUDENT');
    const rows = await this.leaves.listForStudent(studentId);
    const current = currentLeaveStatus(rows, timeline.current);
    const items = rows.map((row) => toLeave(row, timeline.current));
    return {
      current: {
        status: current.status,
        leave: items.find((item) => item.id === current.leaveId) ?? null,
      },
      items,
      earliestStart: timeline.earliest,
      requiresApproval: timeline.policy.leaveRequiresApproval,
    };
  }

  async get(studentId: string, id: string): Promise<Leave> {
    const row = await this.leaves.find(id);
    if (!row || row.studentId !== studentId) throw notFound();
    const timeline = await this.timelines.build(studentId, 'STUDENT');
    return toLeave(row, timeline.current);
  }

  /** Spec §11.1 "Leave Summary", updated as the student fills in the form. */
  async preview(studentId: string, request: ApplyLeaveRequest): Promise<LeavePreview> {
    const timeline = await this.timelines.build(studentId, 'STUDENT');
    const others = await this.leaves.listForStudent(studentId);
    const problem = checkLeaveRange(request, timeline.earliest, others);
    const status = timeline.policy.leaveRequiresApproval ? 'PENDING' : 'APPROVED';
    if (problem) {
      return {
        days: 0,
        meals: 0,
        status,
        bookingsToPause: 0,
        earliestStart: timeline.earliest,
        problem: problem.message,
      };
    }
    const booked = await this.leaves.bookedSlotStarts(
      studentId,
      request.startDate,
      request.endDate,
    );
    return {
      ...countRange(request),
      status,
      // A pending request pauses nothing until it is approved (BR-LEAVE-3).
      bookingsToPause: status === 'PENDING' ? 0 : countPausable(booked, request, timeline.now),
      earliestStart: timeline.earliest,
      problem: null,
    };
  }

  /** Spec §11.1 "Apply Leave", idempotent (ADR-0016). */
  apply(studentId: string, request: ApplyLeaveRequest, key: string): Promise<LeaveResult> {
    return this.idempotency.run({
      context: { actorKey: `student:${studentId}`, key, route: 'POST /leaves', request },
      responseCode: 201,
      responseSchema: leaveResultSchema,
      work: async (tx) => {
        const requiresApproval = (await this.timelines.build(studentId, 'STUDENT', tx)).policy
          .leaveRequiresApproval;
        const outcome = await this.commands.create(
          {
            studentId,
            range: request,
            reason: request.reason?.trim() || null,
            requiresApproval,
          },
          STUDENT,
          tx,
        );
        return this.result(studentId, outcome, tx);
      },
    });
  }

  async extend(studentId: string, id: string, request: ExtendLeaveRequest): Promise<LeaveResult> {
    await this.assertOwn(studentId, id);
    return this.transactions.run(
      async (tx) =>
        this.result(
          studentId,
          await this.commands.extend(
            id,
            { date: request.endDate, mealType: request.endMealType },
            request.version,
            STUDENT,
            tx,
          ),
          tx,
        ),
      { timeoutMs: LEAVE_TIMEOUT_MS },
    );
  }

  async end(studentId: string, id: string, request: EndLeaveRequest): Promise<LeaveResult> {
    await this.assertOwn(studentId, id);
    return this.transactions.run(
      async (tx) =>
        this.result(
          studentId,
          await this.commands.end(
            id,
            { date: request.resumeDate, mealType: request.resumeMealType },
            request.version,
            STUDENT,
            tx,
          ),
          tx,
        ),
      { timeoutMs: LEAVE_TIMEOUT_MS },
    );
  }

  private async assertOwn(studentId: string, id: string): Promise<void> {
    const row = await this.leaves.find(id);
    if (!row || row.studentId !== studentId) throw notFound();
  }

  private async result(
    studentId: string,
    outcome: LeaveOutcome,
    tx: TransactionClient,
  ): Promise<LeaveResult> {
    const timeline = await this.timelines.build(studentId, 'STUDENT', tx);
    const leave = await this.leaves.find(outcome.leaveId, tx);
    if (!leave) throw notFound();
    const extension = outcome.extensionId ? await this.leaves.find(outcome.extensionId, tx) : null;
    return {
      leave: toLeave(leave, timeline.current),
      extensionRequest: extension ? toLeave(extension, timeline.current) : null,
      bookingsPaused: outcome.bookingsPaused,
      bookingsResumed: outcome.bookingsResumed,
    };
  }
}

/** Booked meals in the range whose slot has not started (those are the ones leave pauses). */
function countPausable(booked: Map<string, number>, range: MealRange, now: Date): number {
  let count = 0;
  for (const [key, slotStart] of booked) {
    const [date = '', mealType = 'BREAKFAST'] = key.split('#') as [string, MealType];
    if (isPointInRange(range, { date, mealType }) && toInstant(date, slotStart) > now) count += 1;
  }
  return count;
}

function notFound(): AppError {
  return new AppError(ErrorCode.NOT_FOUND, 'This leave was not found.');
}
