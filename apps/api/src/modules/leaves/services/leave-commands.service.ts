import { Injectable } from '@nestjs/common';
import {
  comparePoints,
  ErrorCode,
  type MealPoint,
  type MealRange,
  nextMeal,
  previousMeal,
  rangeEnd,
  rangeStart,
} from '@ennel/shared';
import { AppError } from '../../../common/errors/app-error';
import { type TransactionClient } from '../../../infrastructure/database/transaction-runner';
import {
  type LeaveActor,
  LeaveBookingSync,
} from '../../bookings/services/leave-booking-sync.service';
import { SyncStudentBookingsService } from '../../default-preferences/services/sync-student-bookings.service';
import { checkLeaveRange, deriveLeaveState } from '../domain/leave-rules';
import { type LeaveRow, LeavesRepository } from '../repositories/leaves.repository';
import { LeaveNotices } from './leave-notices.service';
import { type LeaveTimeline, LeaveTimelineService } from './leave-timeline.service';

export interface LeaveEffects {
  bookingsPaused: number;
  bookingsResumed: number;
}

export interface LeaveOutcome extends LeaveEffects {
  leaveId: string;
  /** A separate pending request for extra days (ADR-0026), when approval is required. */
  extensionId: string | null;
}

const NO_EFFECTS: LeaveEffects = { bookingsPaused: 0, bookingsResumed: 0 };

/**
 * The leave use cases shared by students and staff (Spec §11, Admin §K, BR-LEAVE). Each runs in
 * the caller's transaction, takes the per-student lock, and brings bookings in line with the
 * approved leaves afterwards. Audit entries for staff are written by the admin services.
 */
@Injectable()
export class LeaveCommandsService {
  constructor(
    private readonly leaves: LeavesRepository,
    private readonly timelines: LeaveTimelineService,
    private readonly leaveSync: LeaveBookingSync,
    private readonly recurring: SyncStudentBookingsService,
    private readonly notices: LeaveNotices,
  ) {}

  async create(
    input: {
      studentId: string;
      range: MealRange;
      reason: string | null;
      requiresApproval: boolean;
    },
    actor: LeaveActor,
    tx: TransactionClient,
  ): Promise<LeaveOutcome> {
    const timeline = await this.prepare(input.studentId, actor, tx);
    await this.assertRange(input.studentId, input.range, timeline, null, tx);
    const isApproved = actor.type === 'STAFF' || !input.requiresApproval;
    const leaveId = await this.leaves.create(
      {
        studentId: input.studentId,
        range: input.range,
        reason: input.reason,
        status: isApproved ? 'APPROVED' : 'PENDING',
        createdByStaffId: actor.type === 'STAFF' ? actor.staffId : null,
        decidedById: actor.type === 'STAFF' ? actor.staffId : null,
        decidedAt: isApproved ? timeline.now : null,
      },
      tx,
    );
    if (actor.type === 'STAFF') {
      await this.notices.changedByStaff(input.studentId, leaveId, 'created', timeline.now, tx);
    }
    const effects = isApproved
      ? await this.applyBookings(input.studentId, actor, timeline, tx)
      : NO_EFFECTS;
    return { leaveId, extensionId: null, ...effects };
  }

  /** BR-LEAVE-6: the new end must be later than the current one. */
  async extend(
    leaveId: string,
    end: MealPoint,
    version: number,
    actor: LeaveActor,
    tx: TransactionClient,
  ): Promise<LeaveOutcome> {
    const leave = await this.loadChangeable(leaveId, version, tx);
    const timeline = await this.prepare(leave.studentId, actor, tx);
    if (comparePoints(end, rangeEnd(leave.range)) <= 0) {
      throw rangeInvalid('The new end must be later than the current end.');
    }
    const extended = { ...leave.range, endDate: end.date, endMealType: end.mealType };
    if (
      actor.type === 'STUDENT' &&
      leave.status === 'APPROVED' &&
      timeline.policy.leaveRequiresApproval
    ) {
      return this.requestExtension(leave, end, timeline, tx);
    }
    await this.assertRange(leave.studentId, extended, timeline, leave.id, tx, false);
    await this.save(leave, { range: extended }, 'EXTENDED', actor, tx);
    return { leaveId, extensionId: null, ...(await this.effectsFor(leave, actor, timeline, tx)) };
  }

  /**
   * BR-LEAVE-7: the resume point is the first meal to book again. Resuming at or before the
   * start withdraws the whole leave.
   */
  async end(
    leaveId: string,
    resume: MealPoint,
    version: number,
    actor: LeaveActor,
    tx: TransactionClient,
  ): Promise<LeaveOutcome> {
    const leave = await this.loadChangeable(leaveId, version, tx);
    const timeline = await this.prepare(leave.studentId, actor, tx);
    if (comparePoints(resume, timeline.earliest) < 0) {
      throw rangeInvalid('Meals can only resume from a meal that can still be booked.');
    }
    if (comparePoints(resume, rangeEnd(leave.range)) > 0) {
      throw rangeInvalid('The leave already ends before this meal.');
    }
    const isWithdrawn = comparePoints(resume, rangeStart(leave.range)) <= 0;
    const last = previousMeal(resume);
    const shortened = { ...leave.range, endDate: last.date, endMealType: last.mealType };
    await this.save(
      leave,
      isWithdrawn ? { status: 'CANCELLED' } : { range: shortened },
      'ENDED_EARLY',
      actor,
      tx,
    );
    if (actor.type === 'STAFF') {
      await this.notices.changedByStaff(leave.studentId, leave.id, 'ended', timeline.now, tx);
    }
    return { leaveId, extensionId: null, ...(await this.effectsFor(leave, actor, timeline, tx)) };
  }

  /** Admin §K "correct": staff change the range; started meals are never changed (BR-LEAVE-8). */
  async correct(
    leaveId: string,
    range: MealRange,
    version: number,
    actor: LeaveActor,
    tx: TransactionClient,
  ): Promise<LeaveOutcome> {
    const leave = await this.loadChangeable(leaveId, version, tx);
    const timeline = await this.prepare(leave.studentId, actor, tx);
    await this.assertRange(leave.studentId, range, timeline, leave.id, tx, false);
    await this.save(leave, { range }, 'CORRECTED', actor, tx);
    await this.notices.changedByStaff(leave.studentId, leave.id, 'corrected', timeline.now, tx);
    return { leaveId, extensionId: null, ...(await this.effectsFor(leave, actor, timeline, tx)) };
  }

  /** BR-LEAVE-3/4: approval pauses the booked meals and tells the student. */
  async approve(leaveId: string, version: number, actor: LeaveActor, tx: TransactionClient) {
    const leave = await this.loadPending(leaveId, version, tx);
    const timeline = await this.prepare(leave.studentId, actor, tx);
    await this.assertRange(leave.studentId, leave.range, timeline, leave.id, tx, false);
    await this.write(
      leave,
      { status: 'APPROVED', decidedById: actor.staffId, decidedAt: timeline.now },
      tx,
    );
    await this.notices.decided(leave.studentId, leave.id, 'approved', null, tx);
    return {
      leaveId,
      extensionId: null,
      ...(await this.applyBookings(leave.studentId, actor, timeline, tx)),
    };
  }

  async reject(leaveId: string, version: number, actor: LeaveActor, tx: TransactionClient) {
    const leave = await this.loadPending(leaveId, version, tx);
    const timeline = await this.prepare(leave.studentId, actor, tx);
    await this.write(
      leave,
      {
        status: 'REJECTED',
        rejectionReason: actor.reason,
        decidedById: actor.staffId,
        decidedAt: timeline.now,
      },
      tx,
    );
    await this.notices.decided(leave.studentId, leave.id, 'rejected', actor.reason, tx);
    return { leaveId, extensionId: null, ...NO_EFFECTS };
  }

  private async requestExtension(
    leave: LeaveRow,
    end: MealPoint,
    timeline: LeaveTimeline,
    tx: TransactionClient,
  ): Promise<LeaveOutcome> {
    const first = nextMeal(rangeEnd(leave.range));
    const range = {
      startDate: first.date,
      startMealType: first.mealType,
      endDate: end.date,
      endMealType: end.mealType,
    };
    await this.assertRange(leave.studentId, range, timeline, null, tx);
    const extensionId = await this.leaves.create(
      {
        studentId: leave.studentId,
        range,
        reason: leave.reason,
        status: 'PENDING',
        createdByStaffId: null,
        decidedById: null,
        decidedAt: null,
      },
      tx,
    );
    return { leaveId: leave.id, extensionId, ...NO_EFFECTS };
  }

  private async prepare(studentId: string, actor: LeaveActor, tx: TransactionClient) {
    await this.leaves.lockStudent(studentId, tx);
    return this.timelines.build(studentId, actor.type, tx);
  }

  /** New leaves must start at an open meal; changes to an existing leave only need a valid range. */
  private async assertRange(
    studentId: string,
    range: MealRange,
    timeline: LeaveTimeline,
    excludeId: string | null,
    tx: TransactionClient,
    checkStart = true,
  ): Promise<void> {
    const others = (await this.leaves.listForStudent(studentId, tx)).filter(
      (other) => other.id !== excludeId,
    );
    const earliest = checkStart ? timeline.earliest : rangeStart(range);
    const problem = checkLeaveRange(range, earliest, others);
    if (problem) throw rangeInvalid(problem.message);
  }

  private async loadChangeable(leaveId: string, version: number, tx: TransactionClient) {
    const leave = await this.leaves.find(leaveId, tx);
    if (!leave) throw new AppError(ErrorCode.NOT_FOUND, 'This leave was not found.');
    if (leave.status !== 'PENDING' && leave.status !== 'APPROVED') {
      throw new AppError(ErrorCode.VALIDATION_FAILED, 'This leave can no longer be changed.');
    }
    if (leave.version !== version) throw versionConflict();
    return leave;
  }

  private async loadPending(leaveId: string, version: number, tx: TransactionClient) {
    const leave = await this.loadChangeable(leaveId, version, tx);
    if (leave.status !== 'PENDING') {
      throw new AppError(ErrorCode.VALIDATION_FAILED, 'This leave has already been decided.');
    }
    return leave;
  }

  private async save(
    leave: LeaveRow,
    write: { range?: MealRange; status?: 'CANCELLED' },
    kind: 'EXTENDED' | 'ENDED_EARLY' | 'CORRECTED',
    actor: LeaveActor,
    tx: TransactionClient,
  ): Promise<void> {
    await this.write(leave, write, tx);
    await this.leaves.addChange(
      {
        leaveId: leave.id,
        kind,
        before: leave.range,
        after: { ...(write.range ?? leave.range), ...(write.status && { status: write.status }) },
        actorType: actor.type,
        actorStaffId: actor.staffId,
        reason: actor.reason,
      },
      tx,
    );
  }

  private async write(
    leave: LeaveRow,
    write: Parameters<LeavesRepository['update']>[2],
    tx: TransactionClient,
  ) {
    if (!(await this.leaves.update(leave.id, leave.version, write, tx))) throw versionConflict();
  }

  /** Only an approved leave pauses meals, so a pending one changes no bookings. */
  private effectsFor(
    leave: LeaveRow,
    actor: LeaveActor,
    timeline: LeaveTimeline,
    tx: TransactionClient,
  ) {
    return leave.status === 'APPROVED'
      ? this.applyBookings(leave.studentId, actor, timeline, tx)
      : NO_EFFECTS;
  }

  /** BR-LEAVE-4/7: pause and resume against the approved leaves, then refill recurring bookings. */
  private async applyBookings(
    studentId: string,
    actor: LeaveActor,
    timeline: LeaveTimeline,
    tx: TransactionClient,
  ): Promise<LeaveEffects> {
    const approved = (await this.leaves.listForStudent(studentId, tx))
      .filter(
        (leave) =>
          leave.status === 'APPROVED' && deriveLeaveState(leave, timeline.current) !== 'ENDED',
      )
      .map((leave) => leave.range);
    const result = await this.leaveSync.execute(
      studentId,
      approved,
      { actor, policy: timeline.policy, now: timeline.now },
      tx,
    );
    await this.recurring.execute(studentId, tx);
    await this.notices.slotsFull(studentId, result.fullMeals, tx);
    return { bookingsPaused: result.paused, bookingsResumed: result.resumed };
  }
}

function rangeInvalid(message: string): AppError {
  return new AppError(ErrorCode.LEAVE_RANGE_INVALID, message);
}

function versionConflict(): AppError {
  return new AppError(
    ErrorCode.VERSION_CONFLICT,
    'This leave was changed elsewhere. Reload and try again.',
  );
}
