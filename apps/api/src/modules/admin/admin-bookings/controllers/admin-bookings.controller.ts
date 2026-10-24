import { Body, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  type AdminBooking,
  adminBookingListQuerySchema,
  adminCancelBookingRequestSchema,
  adminCorrectStatusRequestSchema,
  adminCreateBookingRequestSchema,
  adminMoveBookingRequestSchema,
  bulkBookingApplyRequestSchema,
  bulkBookingPreviewRequestSchema,
  type BulkBookingResult,
  type Paginated,
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
import { ListAdminBookingsService } from '../services/list-admin-bookings.service';
import { AdminBookingOverridesService } from '../services/admin-booking-overrides.service';
import { BulkBookingsService } from '../services/bulk-bookings.service';

/** Bookings management (Admin §H). */
@AdminController('bookings')
export class AdminBookingsController {
  constructor(
    private readonly listBookings: ListAdminBookingsService,
    private readonly overrides: AdminBookingOverridesService,
    private readonly bulk: BulkBookingsService,
  ) {}

  @Get()
  @RequirePermissions('bookings:read')
  list(
    @Query(new ZodValidationPipe(adminBookingListQuerySchema))
    query: z.output<typeof adminBookingListQuerySchema>,
  ): Promise<Paginated<AdminBooking>> {
    return this.listBookings.execute(query);
  }

  @Post()
  @RequirePermissions('bookings:override')
  create(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Body(new ZodValidationPipe(adminCreateBookingRequestSchema))
    body: z.output<typeof adminCreateBookingRequestSchema>,
  ): Promise<AdminBooking> {
    return this.overrides.create(staff.id, body);
  }

  @Post('bulk/preview')
  @HttpCode(200)
  @RequirePermissions('bookings:bulk')
  previewBulk(
    @Body(new ZodValidationPipe(bulkBookingPreviewRequestSchema))
    body: z.output<typeof bulkBookingPreviewRequestSchema>,
  ): Promise<BulkBookingResult> {
    return this.bulk.preview(body);
  }

  @Post('bulk/apply')
  @HttpCode(200)
  @RequirePermissions('bookings:bulk')
  applyBulk(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Body(new ZodValidationPipe(bulkBookingApplyRequestSchema))
    body: z.output<typeof bulkBookingApplyRequestSchema>,
  ): Promise<BulkBookingResult> {
    return this.bulk.apply(staff.id, body);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermissions('bookings:override')
  cancel(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(adminCancelBookingRequestSchema))
    body: z.output<typeof adminCancelBookingRequestSchema>,
  ): Promise<AdminBooking> {
    return this.overrides.cancel(staff.id, id, body);
  }

  @Post(':id/move')
  @HttpCode(200)
  @RequirePermissions('bookings:override')
  move(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(adminMoveBookingRequestSchema))
    body: z.output<typeof adminMoveBookingRequestSchema>,
  ): Promise<AdminBooking> {
    return this.overrides.move(staff.id, id, body);
  }

  @Post(':id/correct-status')
  @HttpCode(200)
  @RequirePermissions('bookings:override')
  correctStatus(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(adminCorrectStatusRequestSchema))
    body: z.output<typeof adminCorrectStatusRequestSchema>,
  ): Promise<AdminBooking> {
    return this.overrides.correctStatus(staff.id, id, body);
  }
}
