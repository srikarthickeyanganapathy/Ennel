// Web build only (Metro picks this file over token-storage.ts for `expo start --web`).
// expo-secure-store has no browser implementation, and browser storage is readable by any script
// on the page, so the web preview keeps the refresh token in memory: a reload signs the student out.
// The student app ships on phones; the web build exists for development convenience.
let refreshToken: string | null = null;

export function readRefreshToken(): Promise<string | null> {
  return Promise.resolve(refreshToken);
}

export function writeRefreshToken(token: string): Promise<void> {
  refreshToken = token;
  return Promise.resolve();
}

export function deleteRefreshToken(): Promise<void> {
  refreshToken = null;
  return Promise.resolve();
}
