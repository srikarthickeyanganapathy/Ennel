import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // The API runs on :3000; proxying keeps the refresh-token cookie same-origin (ADR-0015).
    // ADMIN_API_PROXY points a second dev copy at another API, e.g. a preview database.
    proxy: { '/api': process.env.ADMIN_API_PROXY ?? 'http://localhost:3000' },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    clearMocks: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.spec.{ts,tsx}'],
  },
});
