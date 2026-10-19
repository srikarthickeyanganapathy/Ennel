import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Integration tests run against TEST_DATABASE_URL (docker-compose.dev.yml creates ennel_test).
const rootEnvFile = resolve(import.meta.dirname, '../../.env');
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is not set; see .env.example');

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/integration/**/*.int.spec.ts'],
    environment: 'node',
    env: { NODE_ENV: 'test', DATABASE_URL: testDatabaseUrl },
    globalSetup: ['test/integration/global-setup.ts'],
    // One database: test files must not interleave.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
