// libs/platform/auth-ui/vitest.config.mts

/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/platform/auth-ui',

  plugins: [
    angular({}),

    nxViteTsPaths()
  ],

  // 'resolve.alias' and 'ssr' blocks are removed for a cleaner config.

  test: {
    name: 'auth-ui',
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    reporters: ['default', 'html'],
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/platform/auth-ui',
      provider: 'v8',
    },
  },
});
