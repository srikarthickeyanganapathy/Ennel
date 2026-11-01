import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createAppealRequestSchema,
  mealTypeSchema,
  type NoShowSummary,
  type StudentNoShowEvent,
} from '@ennel/shared';
import { type z } from 'zod';
import {
  type AuthenticatedStudent,
  CurrentStudent,
} from '../../../common/decorators/current-student.decorator';
import { StudentJwtAuthGuard } from '../../../common/guards/student-jwt-auth.guard';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { StudentNoShowsService } from '../services/student-no-shows.service';

/** No-show counts, warnings and reports (Spec §7, §10). */
@ApiTags('no-shows')
@ApiBearerAuth()
@Controller('no-shows')
@UseGuards(StudentJwtAuthGuard)
export class NoShowsController {
  constructor(private readonly noShows: StudentNoShowsService) {}

  @Get('summary')
  summary(@CurrentStudent() student: AuthenticatedStudent): Promise<NoShowSummary> {
    return this.noShows.summary(student.id);
  }

  @Post(':id/appeals')
  appeal(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createAppealRequestSchema))
    body: z.output<typeof createAppealRequestSchema>,
  ): Promise<StudentNoShowEvent> {
    return this.noShows.appeal(student.id, id, body.message);
  }

  @Post('meals/:meal/re-enable')
  @HttpCode(200)
  reEnable(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('meal', new ZodValidationPipe(mealTypeSchema)) meal: z.output<typeof mealTypeSchema>,
  ): Promise<NoShowSummary> {
    return this.noShows.reEnable(student.id, meal);
  }
}
