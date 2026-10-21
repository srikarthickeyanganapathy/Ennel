import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type SlotAvailabilityResponse, slotAvailabilityQuerySchema } from '@ennel/shared';
import { type z } from 'zod';
import { StudentJwtAuthGuard } from '../../../common/guards/student-jwt-auth.guard';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { GetSlotAvailabilityService } from '../services/get-slot-availability.service';

@ApiTags('slots')
@ApiBearerAuth()
@Controller('slots')
@UseGuards(StudentJwtAuthGuard)
export class SlotsController {
  constructor(private readonly availability: GetSlotAvailabilityService) {}

  @Get('availability')
  get(
    @Query(new ZodValidationPipe(slotAvailabilityQuerySchema))
    query: z.output<typeof slotAvailabilityQuerySchema>,
  ): Promise<SlotAvailabilityResponse> {
    return this.availability.execute(query.date, query.meal);
  }
}
