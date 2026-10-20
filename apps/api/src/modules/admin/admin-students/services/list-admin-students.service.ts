import { Injectable } from '@nestjs/common';
import {
  addBusinessDays,
  type AdminStudentDetail,
  type AdminStudentListItem,
  ErrorCode,
  type Paginated,
  toBusinessDate,
} from '@ennel/shared';
import { AppError } from '../../../../common/errors/app-error';
import { Clock } from '../../../../infrastructure/clock/clock';
import { GetMessPolicyService } from '../../../mess-config/services/get-mess-policy.service';
import {
  type AdminStudentFilter,
  AdminStudentsRepository,
} from '../repositories/admin-students.repository';

/** Admin §G student list and detail page. */
@Injectable()
export class ListAdminStudentsService {
  constructor(
    private readonly students: AdminStudentsRepository,
    private readonly policy: GetMessPolicyService,
    private readonly clock: Clock,
  ) {}

  list(
    filter: AdminStudentFilter,
    page: number,
    pageSize: number,
  ): Promise<Paginated<AdminStudentListItem>> {
    return this.students.list(filter, page, pageSize);
  }

  /** No-show counts use the same rolling window as the student's Profile (BR-NS-3). */
  async detail(rosterEntryId: string): Promise<AdminStudentDetail> {
    const { noShowWindowDays } = await this.policy.execute();
    const today = toBusinessDate(this.clock.now());
    const since = new Date(`${addBusinessDays(today, -(noShowWindowDays - 1))}T00:00:00Z`);
    const detail = await this.students.findDetail(rosterEntryId, since);
    if (!detail) throw new AppError(ErrorCode.NOT_FOUND, 'Student not found.');
    return { ...detail, noShowWindowDays };
  }
}
