// libs/platform/logger/vitest.config.mts

/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { join } from 'path';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../../../node_modules/.vite/libs/platform/node/node-logger',

  plugins: [angular({}), nxViteTsPaths()],
  test: {
    name: 'logger',
    globals: true,
    environment: 'node',
    // setupFiles: ['src/test-setup.ts'],
    reporters: ['default', 'html'],
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    outputFile: {
      html: join(__dirname, '../../../../dist/test-reports/platform/node/node-logger/index.html'),
    },
    coverage: {
      reportsDirectory: '../../../../coverage/libs/platform/node/node-logger',
      provider: 'v8',
    },
  },
});
