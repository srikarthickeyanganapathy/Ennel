import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  bookingHistoryQuerySchema,
  type BookingHistoryResponse,
  type BookingRecord,
} from '@ennel/shared';
import { type z } from 'zod';
import {
  type AuthenticatedStudent,
  CurrentStudent,
} from '../../../common/decorators/current-student.decorator';
import { StudentJwtAuthGuard } from '../../../common/guards/student-jwt-auth.guard';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { BookingHistoryService } from '../services/booking-history.service';

/** My Bookings history and record detail (Spec §7). */
@ApiTags('bookings')
@ApiBearerAuth()
@Controller('bookings')
@UseGuards(StudentJwtAuthGuard)
export class BookingHistoryController {
  constructor(private readonly history: BookingHistoryService) {}

  @Get('history')
  list(
    @CurrentStudent() student: AuthenticatedStudent,
    @Query(new ZodValidationPipe(bookingHistoryQuerySchema))
    query: z.output<typeof bookingHistoryQuerySchema>,
  ): Promise<BookingHistoryResponse> {
    return this.history.list(student.id, query);
  }

  @Get(':id/record')
  record(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BookingRecord> {
    return this.history.record(student.id, id);
  }
}
