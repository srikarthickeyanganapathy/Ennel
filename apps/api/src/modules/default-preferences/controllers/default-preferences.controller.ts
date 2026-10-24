import { Body, Controller, Get, Param, Patch, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  type DefaultPreferences,
  mealTypeSchema,
  type SaveDefaultPreferencesResponse,
  saveDefaultPreferencesRequestSchema,
  updateMealPreferenceRequestSchema,
} from '@ennel/shared';
import { type z } from 'zod';
import {
  type AuthenticatedStudent,
  CurrentStudent,
} from '../../../common/decorators/current-student.decorator';
import { StudentJwtAuthGuard } from '../../../common/guards/student-jwt-auth.guard';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { DefaultPreferencesService } from '../services/default-preferences.service';

/** The Default Booking page (Spec §8). Saving updates upcoming bookings at once (BR-DEF-3). */
@ApiTags('default-preferences')
@ApiBearerAuth()
@Controller('default-preferences')
@UseGuards(StudentJwtAuthGuard)
export class DefaultPreferencesController {
  constructor(private readonly preferences: DefaultPreferencesService) {}

  @Get()
  get(@CurrentStudent() student: AuthenticatedStudent): Promise<DefaultPreferences> {
    return this.preferences.get(student.id);
  }

  @Put()
  saveAll(
    @CurrentStudent() student: AuthenticatedStudent,
    @Body(new ZodValidationPipe(saveDefaultPreferencesRequestSchema))
    body: z.output<typeof saveDefaultPreferencesRequestSchema>,
  ): Promise<SaveDefaultPreferencesResponse> {
    return this.preferences.saveAll(student.id, body);
  }

  @Patch(':meal')
  updateMeal(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('meal', new ZodValidationPipe(mealTypeSchema)) meal: z.output<typeof mealTypeSchema>,
    @Body(new ZodValidationPipe(updateMealPreferenceRequestSchema))
    body: z.output<typeof updateMealPreferenceRequestSchema>,
  ): Promise<SaveDefaultPreferencesResponse> {
    return this.preferences.updateMeal(student.id, meal, body);
  }
}
