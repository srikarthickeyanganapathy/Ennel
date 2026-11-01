import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { COMPLAINT_MAX_PHOTOS, COMPLAINT_PHOTO_MAX_BYTES, ErrorCode } from '@ennel/shared';
import { AppError } from '../../../common/errors/app-error';
import { stripImageMetadata } from '../../../common/utils/image-metadata';
import {
  detectImageType,
  IMAGE_EXTENSIONS,
  type ImageMimeType,
} from '../../../common/utils/image-type';
import { FileStorageProvider } from '../../../infrastructure/storage/file-storage.provider';
import { type NewComplaintPhoto } from '../repositories/complaints.repository';

export interface CheckedPhoto {
  data: Buffer;
  mimeType: ImageMimeType;
  /** Of the original upload, so a retried request with the same photos is recognised. */
  digest: string;
}

/** BR-CMP-3: up to three photos, 5 MB each, type checked by content, metadata removed. */
@Injectable()
export class ComplaintPhotos {
  constructor(private readonly storage: FileStorageProvider) {}

  check(files: readonly Buffer[]): CheckedPhoto[] {
    if (files.length > COMPLAINT_MAX_PHOTOS) {
      throw new AppError(ErrorCode.FILE_INVALID, `Add at most ${COMPLAINT_MAX_PHOTOS} photos.`);
    }
    return files.map((file) => this.checkOne(file));
  }

  /** Stored under the complaint, never the student, so anonymous photos carry no identity. */
  async save(complaintId: string, photos: readonly CheckedPhoto[]): Promise<NewComplaintPhoto[]> {
    const saved: NewComplaintPhoto[] = [];
    for (const photo of photos) {
      const storageKey = `complaint-photos/${complaintId}/${randomUUID()}.${IMAGE_EXTENSIONS[photo.mimeType]}`;
      await this.storage.save(storageKey, photo.data);
      saved.push({ storageKey, mimeType: photo.mimeType, sizeBytes: photo.data.length });
    }
    return saved;
  }

  private checkOne(file: Buffer): CheckedPhoto {
    if (file.length === 0 || file.length > COMPLAINT_PHOTO_MAX_BYTES) {
      throw new AppError(ErrorCode.FILE_INVALID, 'Each photo must be 5 MB or smaller.');
    }
    const mimeType = detectImageType(file);
    const data = mimeType && stripImageMetadata(file, mimeType);
    if (!mimeType || !data) {
      throw new AppError(ErrorCode.FILE_INVALID, 'Use a JPEG, PNG, WebP or HEIC photo.');
    }
    return { data, mimeType, digest: createHash('sha256').update(file).digest('hex') };
  }
}
