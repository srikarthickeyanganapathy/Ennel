import { Body, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  type AdminNoShowList,
  adminNoShowListQuerySchema,
  decideAppealRequestSchema,
  type NoShowActionResult,
  rejectAppealRequestSchema,
  reviewHeldRequestSchema,
  studentMealActionRequestSchema,
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
import { AdminNoShowsService } from '../services/admin-no-shows.service';

/** No-show list and outage review (Admin §J, BR-NS-7). */
@AdminController('no-shows')
export class AdminNoShowsController {
  constructor(private readonly noShows: AdminNoShowsService) {}

  @Get()
  @RequirePermissions('no-shows:read')
  list(
    @Query(new ZodValidationPipe(adminNoShowListQuerySchema))
    query: z.output<typeof adminNoShowListQuerySchema>,
  ): Promise<AdminNoShowList> {
    return this.noShows.list(query);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  @RequirePermissions('no-shows:review-appeal')
  confirm(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(reviewHeldRequestSchema))
    body: z.output<typeof reviewHeldRequestSchema>,
  ): Promise<NoShowActionResult> {
    return this.noShows.reviewHeld(staff.id, id, 'CONFIRM', body.reason);
  }

  @Post(':id/dismiss')
  @HttpCode(200)
  @RequirePermissions('no-shows:review-appeal')
  dismiss(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(reviewHeldRequestSchema))
    body: z.output<typeof reviewHeldRequestSchema>,
  ): Promise<NoShowActionResult> {
    return this.noShows.reviewHeld(staff.id, id, 'DISMISS', body.reason);
  }
}

/** The appeal queue: "report incorrect record" decisions (Admin §J). */
@AdminController('no-show-appeals')
export class AdminNoShowAppealsController {
  constructor(private readonly noShows: AdminNoShowsService) {}

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermissions('no-shows:review-appeal')
  approve(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(decideAppealRequestSchema))
    body: z.output<typeof decideAppealRequestSchema>,
  ): Promise<NoShowActionResult> {
    return this.noShows.decideAppeal(staff.id, id, 'APPROVED', body.reason ?? null);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermissions('no-shows:review-appeal')
  reject(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(rejectAppealRequestSchema))
    body: z.output<typeof rejectAppealRequestSchema>,
  ): Promise<NoShowActionResult> {
    return this.noShows.decideAppeal(staff.id, id, 'REJECTED', body.reason);
  }
}

/** Manual actions on one student's meal (BR-NS-6, BR-NS-8). */
@AdminController('students')
export class AdminStudentNoShowsController {
  constructor(private readonly noShows: AdminNoShowsService) {}

  @Post(':id/no-shows/reset')
  @HttpCode(200)
  @RequirePermissions('no-shows:reset')
  reset(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(studentMealActionRequestSchema))
    body: z.output<typeof studentMealActionRequestSchema>,
  ): Promise<NoShowActionResult> {
    return this.noShows.resetCount(staff.id, id, body.mealType, body.reason);
  }

  @Post(':id/default-booking/re-enable')
  @HttpCode(200)
  @RequirePermissions('no-shows:reset')
  reEnable(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(studentMealActionRequestSchema))
    body: z.output<typeof studentMealActionRequestSchema>,
  ): Promise<NoShowActionResult> {
    return this.noShows.reEnable(id, body.mealType, body.reason);
  }
}
