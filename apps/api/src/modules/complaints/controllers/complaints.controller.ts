import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import {
  COMPLAINT_MAX_PHOTOS,
  COMPLAINT_PHOTO_MAX_BYTES,
  complaintLookupRequestSchema,
  type ComplaintReceipt,
  createComplaintRequestSchema,
  type StudentComplaint,
  type StudentComplaintList,
} from '@ennel/shared';
import { type z } from 'zod';
import {
  type AuthenticatedStudent,
  CurrentStudent,
} from '../../../common/decorators/current-student.decorator';
import { IdempotencyKey } from '../../../common/decorators/idempotency-key.decorator';
import { StudentJwtAuthGuard } from '../../../common/guards/student-jwt-auth.guard';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { StudentComplaintsService } from '../services/student-complaints.service';

/** Complaints and feedback (Spec §12). Internal notes never leave the staff API (BR-CMP-1). */
@ApiTags('complaints')
@ApiBearerAuth()
@Controller('complaints')
@UseGuards(StudentJwtAuthGuard)
export class ComplaintsController {
  constructor(private readonly complaints: StudentComplaintsService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  // One over each limit, so the service can answer with the friendly message instead of multer.
  @UseInterceptors(
    FilesInterceptor('photos', COMPLAINT_MAX_PHOTOS + 1, {
      limits: { fileSize: COMPLAINT_PHOTO_MAX_BYTES + 1, files: COMPLAINT_MAX_PHOTOS + 1 },
    }),
  )
  submit(
    @CurrentStudent() student: AuthenticatedStudent,
    @IdempotencyKey() key: string,
    @Body(new ZodValidationPipe(createComplaintRequestSchema))
    body: z.output<typeof createComplaintRequestSchema>,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ): Promise<ComplaintReceipt> {
    const photos = (files ?? []).map((file) => file.buffer);
    return this.complaints.submit(student.id, body, photos, key);
  }

  @Get()
  list(@CurrentStudent() student: AuthenticatedStudent): Promise<StudentComplaintList> {
    return this.complaints.list(student.id);
  }

  @Post('lookup')
  @HttpCode(200)
  async lookup(
    @Body(new ZodValidationPipe(complaintLookupRequestSchema))
    body: z.output<typeof complaintLookupRequestSchema>,
  ): Promise<{ items: StudentComplaint[] }> {
    return { items: await this.complaints.lookup(body.receiptTokens) };
  }

  @Get(':id')
  get(
    @CurrentStudent() student: AuthenticatedStudent,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StudentComplaint> {
    return this.complaints.get(student.id, id);
  }
}
