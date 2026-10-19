import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ErrorCode, type StudentProfile } from '@ennel/shared';
import { AppError } from '../../../common/errors/app-error';
import { detectImageType, IMAGE_EXTENSIONS } from '../../../common/utils/image-type';
import { FileStorageProvider } from '../../../infrastructure/storage/file-storage.provider';
import { StudentProfileRepository } from '../repositories/student-profile.repository';
import { GetMyProfileService } from './get-my-profile.service';

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Spec §3 Screen 5 "Add / Change Photo". Type is checked from content, not the file name. */
@Injectable()
export class UpdateMyPhotoService {
  private readonly logger = new Logger(UpdateMyPhotoService.name);

  constructor(
    private readonly profiles: StudentProfileRepository,
    private readonly storage: FileStorageProvider,
    private readonly getProfile: GetMyProfileService,
  ) {}

  async execute(studentId: string, data: Buffer | undefined): Promise<StudentProfile> {
    if (!data || data.length === 0) {
      throw new AppError(ErrorCode.FILE_INVALID, 'Choose a photo to upload.');
    }
    if (data.length > MAX_PHOTO_BYTES) {
      throw new AppError(ErrorCode.FILE_INVALID, 'The photo must be 5 MB or smaller.');
    }
    const mimeType = detectImageType(data);
    if (!mimeType) {
      throw new AppError(ErrorCode.FILE_INVALID, 'Use a JPEG, PNG, WebP or HEIC photo.');
    }
    const key = `student-photos/${studentId}/${randomUUID()}.${IMAGE_EXTENSIONS[mimeType]}`;
    await this.storage.save(key, data);
    const previousKey = await this.profiles.replacePhotoKey(studentId, key);
    if (previousKey) await this.deleteQuietly(previousKey);
    return this.getProfile.execute(studentId);
  }

  // A leftover old photo is harmless; it must not fail an upload that already succeeded.
  private async deleteQuietly(key: string): Promise<void> {
    try {
      await this.storage.delete(key);
    } catch (error) {
      this.logger.warn('Could not delete previous photo', error);
    }
  }
}
