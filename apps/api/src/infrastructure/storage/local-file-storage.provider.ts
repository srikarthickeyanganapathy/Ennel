import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { FileStorageProvider, isSafeStorageKey } from './file-storage.provider';

@Injectable()
export class LocalFileStorageProvider extends FileStorageProvider {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    super();
  }

  async save(key: string, data: Buffer): Promise<void> {
    const path = this.resolve(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async read(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolve(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  private resolve(key: string): string {
    if (!isSafeStorageKey(key)) throw new Error('Unsafe storage key');
    return join(this.config.storageDir, key);
  }
}
