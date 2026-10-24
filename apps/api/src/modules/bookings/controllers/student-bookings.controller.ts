import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  bookMealRequestSchema,
  businessDateSchema,
  type CancelEligibleResponse,
  changeBookingRequestSchema,
  type DayResponse,
  type MealCard,
} from '@ennel/shared';
import { type z } from 'zod';
import {
  type AuthenticatedStudent,
  CurrentStudent,
} from '../../../common/decorators/current-student.decorator';
import { IdempotencyKey } from '../../../common/decorators/idempotency-key.decorator';
import { StudentJwtAuthGuard } from '../../../common/guards/student-jwt-auth.guard';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { StudentBookingsService } from '../services/student-bookings.service';

const datePipe = new ZodValidationPipe(businessDateSchema);

/** Home and Slot Selection (Spec §4, §5). Writes need an Idempotency-Key (ADR-0016). */
@ApiTags('bookings')
@ApiBearerAuth()
@Controller()
@UseGuards(StudentJwtAuthGuard)
export class StudentBookingsController {
  constructor(private readonly bookings: StudentBookingsService) {}

  @Get('days/:date')
  getDay(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('date', datePipe) date: string,
  ): Promise<DayResponse> {
    return this.bookings.getDay(student.id, date);
  }

  @Post('days/:date/cancel-eligible')
  @HttpCode(200)
  cancelEligible(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('date', datePipe) date: string,
    @IdempotencyKey() key: string,
  ): Promise<CancelEligibleResponse> {
    return this.bookings.cancelEligible(student.id, date, key);
  }

  @Post('bookings')
  book(
    @CurrentStudent() student: AuthenticatedStudent,
    @Body(new ZodValidationPipe(bookMealRequestSchema))
    body: z.output<typeof bookMealRequestSchema>,
    @IdempotencyKey() key: string,
  ): Promise<MealCard> {
    return this.bookings.book(student.id, body, key);
  }

  @Patch('bookings/:id')
  change(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(changeBookingRequestSchema))
    body: z.output<typeof changeBookingRequestSchema>,
    @IdempotencyKey() key: string,
  ): Promise<MealCard> {
    return this.bookings.change(student.id, id, body, key);
  }

  @Post('bookings/:id/cancel')
  @HttpCode(200)
  cancel(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('id', ParseUUIDPipe) id: string,
    @IdempotencyKey() key: string,
  ): Promise<MealCard> {
    return this.bookings.cancel(student.id, id, key);
  }
}
