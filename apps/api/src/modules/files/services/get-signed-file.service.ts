import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@ennel/shared';
import { AppError } from '../../../common/errors/app-error';
import { IMAGE_EXTENSIONS, type ImageMimeType } from '../../../common/utils/image-type';
import { Clock } from '../../../infrastructure/clock/clock';
import {
  FileStorageProvider,
  isSafeStorageKey,
} from '../../../infrastructure/storage/file-storage.provider';
import { FileUrlSigner } from '../../../infrastructure/storage/file-url-signer';

const CONTENT_TYPES = new Map(
  Object.entries(IMAGE_EXTENSIONS).map(([mime, extension]) => [extension, mime as ImageMimeType]),
);

export interface SignedFile {
  data: Buffer;
  contentType: string;
}

@Injectable()
export class GetSignedFileService {
  constructor(
    private readonly storage: FileStorageProvider,
    private readonly signer: FileUrlSigner,
    private readonly clock: Clock,
  ) {}

  async execute(key: string, expires: number, signature: string): Promise<SignedFile> {
    // One response for every failure so the endpoint cannot be used to probe for files.
    const notFound = new AppError(ErrorCode.NOT_FOUND, 'File not found or link expired.');
    if (!isSafeStorageKey(key) || !this.signer.isValid(key, expires, signature, this.clock.now())) {
      throw notFound;
    }
    const data = await this.storage.read(key);
    if (!data) throw notFound;
    const extension = key.slice(key.lastIndexOf('.') + 1);
    return { data, contentType: CONTENT_TYPES.get(extension) ?? 'application/octet-stream' };
  }
}
