// libs/platform/sdk-core/vitest.config.ts (New File)

/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/platform/sdk-core',
  plugins: [
    nxViteTsPaths()
  ],
  test: {
    name: 'sdk-core',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/platform/sdk-core',
      provider: 'v8' as const,
    },
  },
}));
