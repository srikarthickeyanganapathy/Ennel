import { Body, Controller, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { type AttendanceDetail, devVerificationRequestSchema } from '@ennel/shared';
import { type z } from 'zod';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { DevVerificationService } from '../services/dev-verification.service';

/** `POST /api/v1/dev/attendance`: a simulated face verification, development only (ADR-0025). */
@ApiExcludeController()
@Controller('dev/attendance')
export class DevAttendanceController {
  constructor(private readonly verifications: DevVerificationService) {}

  @Post()
  verify(
    @Body(new ZodValidationPipe(devVerificationRequestSchema))
    body: z.output<typeof devVerificationRequestSchema>,
  ): Promise<AttendanceDetail> {
    return this.verifications.verify(body);
  }
}
