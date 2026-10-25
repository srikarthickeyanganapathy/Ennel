import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createWeekdayRulesRequestSchema,
  deleteWeekdayRuleQuerySchema,
  updateWeekdayRuleRequestSchema,
  type WeekdayRuleResult,
  type WeekdayRulesResponse,
} from '@ennel/shared';
import { type z } from 'zod';
import {
  type AuthenticatedStudent,
  CurrentStudent,
} from '../../../common/decorators/current-student.decorator';
import { StudentJwtAuthGuard } from '../../../common/guards/student-jwt-auth.guard';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { WeekdayRulesService } from '../services/weekday-rules.service';

/** Plan Ahead "Choose a Day" weekday rules (Spec §6.2). */
@ApiTags('weekday-rules')
@ApiBearerAuth()
@Controller('weekday-rules')
@UseGuards(StudentJwtAuthGuard)
export class WeekdayRulesController {
  constructor(private readonly rules: WeekdayRulesService) {}

  @Get()
  async list(@CurrentStudent() student: AuthenticatedStudent): Promise<WeekdayRulesResponse> {
    return { items: await this.rules.list(student.id) };
  }

  @Post()
  create(
    @CurrentStudent() student: AuthenticatedStudent,
    @Body(new ZodValidationPipe(createWeekdayRulesRequestSchema))
    body: z.output<typeof createWeekdayRulesRequestSchema>,
  ): Promise<WeekdayRuleResult> {
    return this.rules.create(student.id, body);
  }

  @Patch(':id')
  update(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateWeekdayRuleRequestSchema))
    body: z.output<typeof updateWeekdayRuleRequestSchema>,
  ): Promise<WeekdayRuleResult> {
    return this.rules.update(student.id, id, body);
  }

  @Delete(':id')
  remove(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(deleteWeekdayRuleQuerySchema))
    query: z.output<typeof deleteWeekdayRuleQuerySchema>,
  ): Promise<WeekdayRuleResult> {
    return this.rules.remove(student.id, id, query.version);
  }
}
