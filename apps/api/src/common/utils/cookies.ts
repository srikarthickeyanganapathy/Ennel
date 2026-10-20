import type { Request } from 'express';

/** Reads one cookie without a parsing library; values are URI-decoded. */
export function readCookie(request: Request, name: string): string | null {
  const header = request.header('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [rawName, ...rest] = part.trim().split('=');
    if (rawName === name) {
      try {
        return decodeURIComponent(rest.join('='));
      } catch {
        return null;
      }
    }
  }
  return null;
}
