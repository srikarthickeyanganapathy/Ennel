import { Body, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  type AdminLeaveList,
  adminLeaveListQuerySchema,
  type AdminLeaveResult,
  type LeaveCalendar,
  leaveCalendarQuerySchema,
  approveLeaveRequestSchema,
  correctLeaveRequestSchema,
  createStaffLeaveRequestSchema,
  rejectLeaveRequestSchema,
  staffEndLeaveRequestSchema,
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
import { AdminLeavesService } from '../services/admin-leaves.service';

/** Leave list, approval queue and changes on a student's behalf (Admin §K). */
@AdminController('leaves')
export class AdminLeavesController {
  constructor(private readonly leaves: AdminLeavesService) {}

  @Get()
  @RequirePermissions('leaves:read')
  list(
    @Query(new ZodValidationPipe(adminLeaveListQuerySchema))
    query: z.output<typeof adminLeaveListQuerySchema>,
  ): Promise<AdminLeaveList> {
    return this.leaves.list(query);
  }

  @Get('calendar')
  @RequirePermissions('leaves:read')
  calendar(
    @Query(new ZodValidationPipe(leaveCalendarQuerySchema))
    query: z.output<typeof leaveCalendarQuerySchema>,
  ): Promise<LeaveCalendar> {
    return this.leaves.calendar(query.month);
  }

  @Post()
  @RequirePermissions('leaves:manage')
  create(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Body(new ZodValidationPipe(createStaffLeaveRequestSchema))
    body: z.output<typeof createStaffLeaveRequestSchema>,
  ): Promise<AdminLeaveResult> {
    return this.leaves.create(staff.id, body);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermissions('leaves:approve')
  approve(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(approveLeaveRequestSchema))
    body: z.output<typeof approveLeaveRequestSchema>,
  ): Promise<AdminLeaveResult> {
    return this.leaves.approve(staff.id, id, body.version);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermissions('leaves:approve')
  reject(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(rejectLeaveRequestSchema))
    body: z.output<typeof rejectLeaveRequestSchema>,
  ): Promise<AdminLeaveResult> {
    return this.leaves.reject(staff.id, id, body.version, body.reason);
  }

  @Post(':id/end')
  @HttpCode(200)
  @RequirePermissions('leaves:manage')
  end(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(staffEndLeaveRequestSchema))
    body: z.output<typeof staffEndLeaveRequestSchema>,
  ): Promise<AdminLeaveResult> {
    return this.leaves.end(staff.id, id, body);
  }

  @Patch(':id')
  @RequirePermissions('leaves:manage')
  correct(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(correctLeaveRequestSchema))
    body: z.output<typeof correctLeaveRequestSchema>,
  ): Promise<AdminLeaveResult> {
    return this.leaves.correct(staff.id, id, body);
  }
}
