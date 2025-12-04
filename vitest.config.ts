// vitest.config.ts (at the root of your monorepo)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // This effectively replaces the old defineWorkspace file
    projects: [
      'apps/**/vitest.config.{ts,mts,js,jsx,tsx}',
      'libs/**/vitest.config.{ts,mts,js,jsx,tsx}',
    ],
  },
});
