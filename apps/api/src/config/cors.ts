import { type AppConfig } from './app-config';

const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * Browser origins allowed to call the API. Production allows only the admin dashboard. In
 * development any localhost origin is allowed too, so the student app's web preview
 * (`expo start --web`, port 8081) works. Phones are not browsers and are not affected by CORS.
 */
export function isAllowedOrigin(
  origin: string | undefined,
  config: Pick<AppConfig, 'nodeEnv' | 'adminWebOrigin'>,
): boolean {
  if (!origin) return true; // same-origin requests, curl, mobile apps
  if (origin === config.adminWebOrigin) return true;
  return config.nodeEnv === 'development' && LOCAL_ORIGIN.test(origin);
}
