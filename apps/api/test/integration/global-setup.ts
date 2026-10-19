import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

/** Brings the test database schema up to date once per run. */
export default function setup(): void {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is not set');
  execSync('pnpm exec prisma migrate deploy', {
    cwd: resolve(import.meta.dirname, '../..'),
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: 'pipe',
  });
}
