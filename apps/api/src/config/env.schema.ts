import { z } from 'zod';

/** Every environment variable the API reads; validated once at startup (fail fast). */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_STUDENT_SECRET: z.string().min(32),
  JWT_STAFF_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).default(30),
  STAFF_REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).default(7),
  /** 32 bytes, base64; encrypts staff TOTP secrets at rest. */
  TOTP_ENCRYPTION_KEY: z.string().refine((value) => Buffer.from(value, 'base64').length === 32, {
    message: 'Must be 32 bytes, base64-encoded',
  }),
  STORAGE_DIR: z.string().min(1).default('./storage'),
  FILE_SIGNING_SECRET: z.string().min(32),
  ADMIN_WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  /** Push delivery (ADR-0028): off by default; `expo` sends through Expo's push service. */
  PUSH_PROVIDER: z.enum(['none', 'expo']).default('none'),
  /** Optional Expo access token, needed only when the Expo project enforces push security. */
  EXPO_ACCESS_TOKEN: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;
