import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { type Env, envSchema } from './env.schema';

export const APP_CONFIG = Symbol('APP_CONFIG');

export interface AppConfig {
  nodeEnv: Env['NODE_ENV'];
  port: number;
  databaseUrl: string;
  redisUrl: string;
  jwt: {
    studentSecret: string;
    staffSecret: string;
    accessTtlSeconds: number;
    refreshTtlDays: number;
  };
  storageDir: string;
  adminWebOrigin: string;
}

/** The repo keeps a single .env at its root; values already in the environment win. */
function loadRootEnvFile(): void {
  const rootEnvFile = resolve(__dirname, '../../../../.env');
  if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);
}

export function parseAppConfig(source: NodeJS.ProcessEnv): AppConfig {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    // Only field names are reported, never values, so secrets cannot leak into logs.
    throw new Error(`Invalid environment configuration: ${fields}`);
  }
  const env = result.data;
  return {
    nodeEnv: env.NODE_ENV,
    port: env.API_PORT,
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    jwt: {
      studentSecret: env.JWT_STUDENT_SECRET,
      staffSecret: env.JWT_STAFF_SECRET,
      accessTtlSeconds: env.JWT_ACCESS_TTL_SECONDS,
      refreshTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
    },
    storageDir: env.STORAGE_DIR,
    adminWebOrigin: env.ADMIN_WEB_ORIGIN,
  };
}

export function loadAppConfig(): AppConfig {
  loadRootEnvFile();
  return parseAppConfig(process.env);
}
