import Constants from 'expo-constants';
import { resolveApiUrl } from './resolve-api-url';

/**
 * API base URL. EXPO_PUBLIC_API_URL in apps/mobile/.env wins when it is a real address. When it
 * is localhost (the default), a phone or emulator uses the computer address it loaded the app
 * from, so the same .env works on this computer and on a phone on the same Wi-Fi.
 */
export const API_URL = resolveApiUrl(
  process.env.EXPO_PUBLIC_API_URL,
  Constants.expoConfig?.hostUri,
);

if (__DEV__) {
  // Shown in the Expo terminal: the first thing to check when the app cannot reach the API.
  console.log(`[ENNEL] API_URL = ${API_URL}`);
}
