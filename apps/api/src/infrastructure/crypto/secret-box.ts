import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** Encrypts small secrets at rest (staff TOTP keys) with AES-256-GCM. Format: iv.tag.data (base64). */
@Injectable()
export class SecretBox {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  seal(plain: Buffer): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.config.totpEncryptionKey, iv);
    const data = Buffer.concat([cipher.update(plain), cipher.final()]);
    return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64')).join('.');
  }

  open(sealed: string): Buffer {
    const [iv, tag, data] = sealed.split('.').map((part) => Buffer.from(part, 'base64'));
    if (!iv || !tag || !data || iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
      throw new Error('Malformed sealed secret');
    }
    const decipher = createDecipheriv(ALGORITHM, this.config.totpEncryptionKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  }
}
