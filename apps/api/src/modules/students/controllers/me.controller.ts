import {
  Body,
  Controller,
  Get,
  Patch,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import {
  completeOnboardingRequestSchema,
  type StudentProfile,
  updateProfileRequestSchema,
} from '@ennel/shared';
import { type z } from 'zod';
import {
  type AuthenticatedStudent,
  CurrentStudent,
} from '../../../common/decorators/current-student.decorator';
import { StudentJwtAuthGuard } from '../../../common/guards/student-jwt-auth.guard';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CompleteOnboardingService } from '../services/complete-onboarding.service';
import { GetMyProfileService } from '../services/get-my-profile.service';
import { MAX_PHOTO_BYTES, UpdateMyPhotoService } from '../services/update-my-photo.service';
import { UpdateMyProfileService } from '../services/update-my-profile.service';

/** The signed-in student's own profile and first-time setup (Spec §3 Screens 5-8, §9). */
@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
@UseGuards(StudentJwtAuthGuard)
export class MeController {
  constructor(
    private readonly getProfile: GetMyProfileService,
    private readonly updateProfile: UpdateMyProfileService,
    private readonly updatePhoto: UpdateMyPhotoService,
    private readonly completeOnboarding: CompleteOnboardingService,
  ) {}

  @Get()
  me(@CurrentStudent() student: AuthenticatedStudent): Promise<StudentProfile> {
    return this.getProfile.execute(student.id);
  }

  @Patch('profile')
  patchProfile(
    @CurrentStudent() student: AuthenticatedStudent,
    @Body(new ZodValidationPipe(updateProfileRequestSchema))
    body: z.output<typeof updateProfileRequestSchema>,
  ): Promise<StudentProfile> {
    const { version, ...changes } = body;
    return this.updateProfile.execute(student.id, { version, changes });
  }

  @Put('photo')
  @ApiConsumes('multipart/form-data')
  // The limit here is a hard stop; the service returns the friendly size message.
  @UseInterceptors(
    FileInterceptor('photo', { limits: { fileSize: MAX_PHOTO_BYTES + 1, files: 1 } }),
  )
  putPhoto(
    @CurrentStudent() student: AuthenticatedStudent,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<StudentProfile> {
    return this.updatePhoto.execute(student.id, file?.buffer);
  }

  @Put('onboarding')
  putOnboarding(
    @CurrentStudent() student: AuthenticatedStudent,
    @Body(new ZodValidationPipe(completeOnboardingRequestSchema))
    body: z.output<typeof completeOnboardingRequestSchema>,
  ): Promise<StudentProfile> {
    return this.completeOnboarding.execute(student.id, body);
  }
}
