import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: '../../local-artifacts/frontend/test-results',
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    browserName: 'chromium',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
    trace: 'retain-on-failure',
  },
  webServer: [
    { command: 'node node_modules/vite/bin/vite.js --config apps/web/vite.config.ts',
      env: { VITE_UI_PREVIEW: 'true', VITE_DEV_TRACK: 'all', VITE_DEVICE_PROFILE: 'phone' },
      url: 'http://127.0.0.1:5173', cwd: process.cwd(), reuseExistingServer: false, timeout: 60000,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 3000 } },
    { command: 'node node_modules/vite/bin/vite.js preview --config apps/web/vite.config.ts --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173', cwd: process.cwd(), reuseExistingServer: false, timeout: 30000,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 3000 } },
  ],
});
