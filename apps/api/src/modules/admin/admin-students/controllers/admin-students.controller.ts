import { Body, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  type AdminStudentDetail,
  type AdminStudentList,
  adminStudentListQuerySchema,
  bulkHostelRequestSchema,
  type CredentialResetIssued,
  credentialResetRequestSchema,
  reasonRequestSchema,
  updateAdminStudentRequestSchema,
} from '@ennel/shared';
import { type z } from 'zod';
import {
  AdminController,
  RequirePermissions,
} from '../../../../common/decorators/admin.decorators';
import {
  type AuthenticatedStaff,
  CurrentStaff,
} from '../../../../common/decorators/current-staff.decorator';
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe';
import { type StudentAccessAction } from '../domain/student-access';
import { BulkUpdateHostelService } from '../services/bulk-update-hostel.service';
import { ChangeStudentAccessService } from '../services/change-student-access.service';
import { IssueStudentResetService } from '../services/issue-student-reset.service';
import { ListAdminStudentsService } from '../services/list-admin-students.service';
import { UpdateAdminStudentService } from '../services/update-admin-student.service';

type Reason = z.output<typeof reasonRequestSchema>;
const reasonPipe = new ZodValidationPipe(reasonRequestSchema);

/** Student management (Admin §G). `:id` is the roster entry, so unregistered students work too. */
@AdminController('students')
export class AdminStudentsController {
  constructor(
    private readonly listStudents: ListAdminStudentsService,
    private readonly updateStudent: UpdateAdminStudentService,
    private readonly changeAccess: ChangeStudentAccessService,
    private readonly bulkHostel: BulkUpdateHostelService,
    private readonly issueReset: IssueStudentResetService,
  ) {}

  @Get()
  @RequirePermissions('students:read')
  list(
    @Query(new ZodValidationPipe(adminStudentListQuerySchema))
    query: z.output<typeof adminStudentListQuerySchema>,
  ): Promise<AdminStudentList> {
    const { page, pageSize, sortBy: _sortBy, sortOrder: _sortOrder, ...filter } = query;
    return this.listStudents.list(filter, page, pageSize);
  }

  @Post('bulk-hostel')
  @HttpCode(200)
  @RequirePermissions('students:update')
  bulkUpdateHostel(
    @Body(new ZodValidationPipe(bulkHostelRequestSchema))
    body: z.output<typeof bulkHostelRequestSchema>,
  ): Promise<{ updated: number }> {
    return this.bulkHostel.execute(body);
  }

  @Get(':id')
  @RequirePermissions('students:read')
  detail(@Param('id', ParseUUIDPipe) id: string): Promise<AdminStudentDetail> {
    return this.listStudents.detail(id);
  }

  @Patch(':id')
  @RequirePermissions('students:update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateAdminStudentRequestSchema))
    body: z.output<typeof updateAdminStudentRequestSchema>,
  ): Promise<AdminStudentDetail> {
    const { reason, rosterVersion, ...changes } = body;
    return this.updateStudent.execute({ rosterEntryId: id, changes, reason, rosterVersion });
  }

  @Post(':id/lock')
  @HttpCode(200)
  @RequirePermissions('students:lock')
  lock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(reasonPipe) body: Reason,
  ): Promise<AdminStudentDetail> {
    return this.access(id, 'LOCK', body);
  }

  @Post(':id/unlock')
  @HttpCode(200)
  @RequirePermissions('students:lock')
  unlock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(reasonPipe) body: Reason,
  ): Promise<AdminStudentDetail> {
    return this.access(id, 'UNLOCK', body);
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @RequirePermissions('students:deactivate')
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(reasonPipe) body: Reason,
  ): Promise<AdminStudentDetail> {
    return this.access(id, 'DEACTIVATE', body);
  }

  @Post(':id/reactivate')
  @HttpCode(200)
  @RequirePermissions('students:deactivate')
  reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(reasonPipe) body: Reason,
  ): Promise<AdminStudentDetail> {
    return this.access(id, 'REACTIVATE', body);
  }

  @Post(':id/credential-resets')
  @RequirePermissions('students:reset-credentials')
  issueCredentialReset(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(credentialResetRequestSchema))
    body: z.output<typeof credentialResetRequestSchema>,
  ): Promise<CredentialResetIssued> {
    return this.issueReset.execute({
      rosterEntryId: id,
      kind: body.kind,
      reason: body.reason,
      staffId: staff.id,
    });
  }

  private access(
    rosterEntryId: string,
    action: StudentAccessAction,
    body: Reason,
  ): Promise<AdminStudentDetail> {
    return this.changeAccess.execute({ rosterEntryId, action, reason: body.reason });
  }
}
