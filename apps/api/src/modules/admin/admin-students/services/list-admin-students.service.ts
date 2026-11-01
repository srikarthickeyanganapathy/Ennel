import { Injectable } from '@nestjs/common';
import {
  addBusinessDays,
  type AdminStudentDetail,
  type AdminStudentList,
  ErrorCode,
  toBusinessDate,
} from '@ennel/shared';
import { AppError } from '../../../../common/errors/app-error';
import { Clock } from '../../../../infrastructure/clock/clock';
import { type MessPolicy } from '../../../mess-config/domain/mess-policy';
import { GetMessPolicyService } from '../../../mess-config/services/get-mess-policy.service';
import {
  type AdminStudentFilter,
  AdminStudentsRepository,
  type ListContext,
} from '../repositories/admin-students.repository';

/** Admin §G student list and detail page. */
@Injectable()
export class ListAdminStudentsService {
  constructor(
    private readonly students: AdminStudentsRepository,
    private readonly policy: GetMessPolicyService,
    private readonly clock: Clock,
  ) {}

  /** Returns the policy numbers too, so the No-show columns can be read against them. */
  async list(
    filter: AdminStudentFilter,
    page: number,
    pageSize: number,
  ): Promise<AdminStudentList> {
    const policy = await this.policy.execute();
    const result = await this.students.list(filter, this.context(policy), page, pageSize);
    return {
      ...result,
      noShowWindowDays: policy.noShowWindowDays,
      noShowWarningThreshold: policy.noShowWarningThreshold,
      noShowDisableThreshold: policy.noShowDisableThreshold,
    };
  }

  async detail(rosterEntryId: string): Promise<AdminStudentDetail> {
    const policy = await this.policy.execute();
    const detail = await this.students.findDetail(rosterEntryId, this.context(policy));
    if (!detail) throw new AppError(ErrorCode.NOT_FOUND, 'Student not found.');
    return {
      ...detail,
      noShowWindowDays: policy.noShowWindowDays,
      noShowDisableThreshold: policy.noShowDisableThreshold,
    };
  }

  /** No-show counts use the same rolling window as the student's Profile (BR-NS-3). */
  private context(policy: MessPolicy): ListContext {
    const today = toBusinessDate(this.clock.now());
    return {
      noShowSince: new Date(`${addBusinessDays(today, -(policy.noShowWindowDays - 1))}T00:00:00Z`),
      today: new Date(`${today}T00:00:00Z`),
      warningThreshold: policy.noShowWarningThreshold,
    };
  }
}
