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
  applyLeaveRequestSchema,
  endLeaveRequestSchema,
  extendLeaveRequestSchema,
  type Leave,
  type LeavePreview,
  type LeaveResult,
  type LeavesResponse,
} from '@ennel/shared';
import { type z } from 'zod';
import {
  type AuthenticatedStudent,
  CurrentStudent,
} from '../../../common/decorators/current-student.decorator';
import { IdempotencyKey } from '../../../common/decorators/idempotency-key.decorator';
import { StudentJwtAuthGuard } from '../../../common/guards/student-jwt-auth.guard';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { StudentLeavesService } from '../services/student-leaves.service';

/** Leave Management (Spec §11). */
@ApiTags('leaves')
@ApiBearerAuth()
@Controller('leaves')
@UseGuards(StudentJwtAuthGuard)
export class LeavesController {
  constructor(private readonly leaves: StudentLeavesService) {}

  @Get()
  list(@CurrentStudent() student: AuthenticatedStudent): Promise<LeavesResponse> {
    return this.leaves.list(student.id);
  }

  @Post('preview')
  @HttpCode(200)
  preview(
    @CurrentStudent() student: AuthenticatedStudent,
    @Body(new ZodValidationPipe(applyLeaveRequestSchema))
    body: z.output<typeof applyLeaveRequestSchema>,
  ): Promise<LeavePreview> {
    return this.leaves.preview(student.id, body);
  }

  @Post()
  apply(
    @CurrentStudent() student: AuthenticatedStudent,
    @IdempotencyKey() key: string,
    @Body(new ZodValidationPipe(applyLeaveRequestSchema))
    body: z.output<typeof applyLeaveRequestSchema>,
  ): Promise<LeaveResult> {
    return this.leaves.apply(student.id, body, key);
  }

  @Get(':id')
  get(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Leave> {
    return this.leaves.get(student.id, id);
  }

  @Post(':id/extend')
  @HttpCode(200)
  extend(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(extendLeaveRequestSchema))
    body: z.output<typeof extendLeaveRequestSchema>,
  ): Promise<LeaveResult> {
    return this.leaves.extend(student.id, id, body);
  }

  @Post(':id/end')
  @HttpCode(200)
  end(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(endLeaveRequestSchema))
    body: z.output<typeof endLeaveRequestSchema>,
  ): Promise<LeaveResult> {
    return this.leaves.end(student.id, id, body);
  }
}
