import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

// ✅ FIX: Use bracket notation for process.env
const isCI = !!process.env['CI'];

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),

  use: {
    // 🎯 POINT TO THE MOCK PORT (4201)
    baseURL: 'http://localhost:4201',
    trace: 'on-first-retry',
  },

  webServer: {
    // ⚡️ SPIN UP THE MOCK CONFIGURATION
    command: 'npx nx serve contacts-app --configuration=mock',
    url: 'http://localhost:4201',
    reuseExistingServer: !isCI,
    timeout: 120 * 1000,
  },
});
