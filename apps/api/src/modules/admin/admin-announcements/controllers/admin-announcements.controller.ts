import { Body, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import {
  type Announcement,
  announcementAudienceSchema,
  type AnnouncementList,
  announcementListQuerySchema,
  announcementVersionRequestSchema,
  type AudiencePreview,
  createAnnouncementRequestSchema,
  scheduleAnnouncementRequestSchema,
  updateAnnouncementRequestSchema,
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
import { AdminAnnouncementsService } from '../services/admin-announcements.service';

type VersionBody = z.output<typeof announcementVersionRequestSchema>;

/** Announcements: compose, audience, schedule and send (Admin §M). */
@AdminController('announcements')
export class AdminAnnouncementsController {
  constructor(private readonly announcements: AdminAnnouncementsService) {}

  @Get()
  @RequirePermissions('announcements:read')
  list(
    @Query(new ZodValidationPipe(announcementListQuerySchema))
    query: z.output<typeof announcementListQuerySchema>,
  ): Promise<AnnouncementList> {
    return this.announcements.list(query);
  }

  @Post('audience-preview')
  @HttpCode(200)
  @RequirePermissions('announcements:manage')
  preview(
    @Body(new ZodValidationPipe(announcementAudienceSchema))
    body: z.output<typeof announcementAudienceSchema>,
  ): Promise<AudiencePreview> {
    return this.announcements.preview(body);
  }

  @Get(':id')
  @RequirePermissions('announcements:read')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<Announcement> {
    return this.announcements.get(id);
  }

  @Post()
  @RequirePermissions('announcements:manage')
  create(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Body(new ZodValidationPipe(createAnnouncementRequestSchema))
    body: z.output<typeof createAnnouncementRequestSchema>,
  ): Promise<Announcement> {
    return this.announcements.create(staff.id, body);
  }

  @Put(':id')
  @RequirePermissions('announcements:manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateAnnouncementRequestSchema))
    body: z.output<typeof updateAnnouncementRequestSchema>,
  ): Promise<Announcement> {
    return this.announcements.update(id, body);
  }

  @Post(':id/schedule')
  @HttpCode(200)
  @RequirePermissions('announcements:manage')
  schedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(scheduleAnnouncementRequestSchema))
    body: z.output<typeof scheduleAnnouncementRequestSchema>,
  ): Promise<Announcement> {
    return this.announcements.schedule(id, body.scheduledFor, body.version);
  }

  @Post(':id/send')
  @HttpCode(200)
  @RequirePermissions('announcements:manage')
  send(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(announcementVersionRequestSchema)) body: VersionBody,
  ): Promise<Announcement> {
    return this.announcements.sendNow(id, body.version);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermissions('announcements:manage')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(announcementVersionRequestSchema)) body: VersionBody,
  ): Promise<Announcement> {
    return this.announcements.cancel(id, body.version);
  }
}
