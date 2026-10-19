/**
 * API base URL. On a phone, localhost is the phone itself, so set EXPO_PUBLIC_API_URL in
 * apps/mobile/.env to your computer's LAN address, e.g. http://192.168.1.20:3000.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);
