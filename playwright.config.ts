import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 2,
  reporter: 'list',
  timeout: 35_000,
  // Labs are lazy-loaded, so the first lookup on a route can wait for its chunk.
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:5197',
    browserName: 'chromium',
    viewport: { width: 1366, height: 768 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 5197 --strictPort',
    url: 'http://127.0.0.1:5197',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
