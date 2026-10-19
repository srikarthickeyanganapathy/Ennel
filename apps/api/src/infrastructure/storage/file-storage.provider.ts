/** Stores uploaded files (photos, import files). Local disk for the MVP. */
export abstract class FileStorageProvider {
  abstract save(key: string, data: Buffer): Promise<void>;
  abstract read(key: string): Promise<Buffer | null>;
  abstract delete(key: string): Promise<void>;
}

// Keys are generated server-side; this guards against path traversal if one ever is not.
const SAFE_KEY = /^[a-z0-9][a-z0-9/_-]*\.[a-z0-9]{2,5}$/;

export function isSafeStorageKey(key: string): boolean {
  return SAFE_KEY.test(key) && !key.includes('..') && !key.includes('//');
}
