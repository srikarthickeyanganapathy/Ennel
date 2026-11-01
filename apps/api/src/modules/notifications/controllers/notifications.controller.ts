import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  type NotificationList,
  notificationListQuerySchema,
  registerPushTokenRequestSchema,
} from '@ennel/shared';
import { type z } from 'zod';
import {
  type AuthenticatedStudent,
  CurrentStudent,
} from '../../../common/decorators/current-student.decorator';
import { StudentJwtAuthGuard } from '../../../common/guards/student-jwt-auth.guard';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { NotificationCentreService } from '../services/notification-centre.service';

/** Notification centre and push devices (Spec §13). */
@ApiTags('notifications')
@ApiBearerAuth()
@Controller()
@UseGuards(StudentJwtAuthGuard)
export class NotificationsController {
  constructor(private readonly centre: NotificationCentreService) {}

  @Get('notifications')
  list(
    @CurrentStudent() student: AuthenticatedStudent,
    @Query(new ZodValidationPipe(notificationListQuerySchema))
    query: z.output<typeof notificationListQuerySchema>,
  ): Promise<NotificationList> {
    return this.centre.list(student.id, query);
  }

  @Get('notifications/unread-count')
  unreadCount(@CurrentStudent() student: AuthenticatedStudent): Promise<{ unreadCount: number }> {
    return this.centre.unreadCount(student.id);
  }

  @Post('notifications/read-all')
  @HttpCode(200)
  markAllRead(@CurrentStudent() student: AuthenticatedStudent): Promise<{ unreadCount: number }> {
    return this.centre.markAllRead(student.id);
  }

  @Post('notifications/:id/read')
  @HttpCode(200)
  markRead(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ unreadCount: number }> {
    return this.centre.markRead(student.id, id);
  }

  @Put('push-tokens')
  @HttpCode(204)
  registerPushToken(
    @CurrentStudent() student: AuthenticatedStudent,
    @Body(new ZodValidationPipe(registerPushTokenRequestSchema))
    body: z.output<typeof registerPushTokenRequestSchema>,
  ): Promise<void> {
    return this.centre.registerPushToken(student.id, body);
  }
}
