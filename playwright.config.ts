import { defineConfig, devices } from '@playwright/test'

const localChromium = process.env.PW_CHROMIUM_PATH

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:4173' },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: localChromium ? { executablePath: localChromium } : {},
      },
    },
    ...(process.env.CI ? [{ name: 'webkit', use: { ...devices['Desktop Safari'] } }] : []),
  ],
})
