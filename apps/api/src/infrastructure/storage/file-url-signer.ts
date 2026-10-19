import { createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';

export const FILE_ROUTE_PREFIX = '/api/v1/files/';
export const DEFAULT_FILE_URL_TTL_SECONDS = 15 * 60;

/**
 * Short-lived signed URLs, so images load without auth headers yet cannot be shared
 * indefinitely (Admin §L "photo viewing via signed URLs").
 */
@Injectable()
export class FileUrlSigner {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  createUrl(key: string, now: Date, ttlSeconds = DEFAULT_FILE_URL_TTL_SECONDS): string {
    const expires = Math.floor(now.getTime() / 1000) + ttlSeconds;
    const signature = this.sign(key, expires);
    return `${FILE_ROUTE_PREFIX}${key}?exp=${expires}&sig=${signature}`;
  }

  isValid(key: string, expires: number, signature: string, now: Date): boolean {
    if (!Number.isInteger(expires) || expires * 1000 <= now.getTime()) return false;
    const expected = Buffer.from(this.sign(key, expires));
    const actual = Buffer.from(signature);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private sign(key: string, expires: number): string {
    return createHmac('sha256', this.config.fileSigningSecret)
      .update(`${key}:${expires}`)
      .digest('base64url');
  }
}
