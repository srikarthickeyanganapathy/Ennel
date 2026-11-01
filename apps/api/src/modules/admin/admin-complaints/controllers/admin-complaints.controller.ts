import { Body, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  addComplaintNoteRequestSchema,
  type AdminComplaint,
  type AdminComplaintDetail,
  type AdminComplaintList,
  adminComplaintListQuerySchema,
  assignComplaintRequestSchema,
  changeComplaintStatusRequestSchema,
  type ComplaintAnalytics,
  complaintAnalyticsQuerySchema,
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
import { AdminComplaintActionsService } from '../services/admin-complaint-actions.service';
import { AdminComplaintsService } from '../services/admin-complaints.service';

/** Complaints and feedback inbox (Admin §L). */
@AdminController('complaints')
export class AdminComplaintsController {
  constructor(
    private readonly complaints: AdminComplaintsService,
    private readonly actions: AdminComplaintActionsService,
  ) {}

  @Get()
  @RequirePermissions('complaints:read')
  list(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Query(new ZodValidationPipe(adminComplaintListQuerySchema))
    query: z.output<typeof adminComplaintListQuerySchema>,
  ): Promise<AdminComplaintList> {
    return this.complaints.list(staff.id, query);
  }

  @Get('analytics')
  @RequirePermissions('complaints:read')
  analytics(
    @Query(new ZodValidationPipe(complaintAnalyticsQuerySchema))
    query: z.output<typeof complaintAnalyticsQuerySchema>,
  ): Promise<ComplaintAnalytics> {
    return this.complaints.analytics(query.from, query.to);
  }

  @Get('assignees')
  @RequirePermissions('complaints:assign')
  assignees(): Promise<{ items: { id: string; fullName: string }[] }> {
    return this.complaints.assignees();
  }

  @Get(':id')
  @RequirePermissions('complaints:read')
  detail(@Param('id', ParseUUIDPipe) id: string): Promise<AdminComplaintDetail> {
    return this.complaints.detail(id);
  }

  @Post(':id/status')
  @HttpCode(200)
  @RequirePermissions('complaints:resolve')
  changeStatus(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(changeComplaintStatusRequestSchema))
    body: z.output<typeof changeComplaintStatusRequestSchema>,
  ): Promise<AdminComplaint> {
    return this.actions.changeStatus(staff.id, id, body);
  }

  @Post(':id/assign')
  @HttpCode(200)
  @RequirePermissions('complaints:assign')
  assign(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(assignComplaintRequestSchema))
    body: z.output<typeof assignComplaintRequestSchema>,
  ): Promise<AdminComplaint> {
    return this.actions.assign(staff.id, id, body);
  }

  @Post(':id/notes')
  @RequirePermissions('complaints:note')
  addNote(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(addComplaintNoteRequestSchema))
    body: z.output<typeof addComplaintNoteRequestSchema>,
  ): Promise<{ id: string }> {
    return this.actions.addNote(staff.id, id, body.body);
  }
}
