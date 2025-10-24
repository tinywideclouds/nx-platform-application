/// <reference types='vitest' />
// FIX: Import from 'vitest/config', not 'vite'
import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import {join} from "path";

export default defineConfig({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/apps/messenger/ng-action-intention',

  plugins: [
    // This is correct
    angular({}),
    // This is correct
    nxViteTsPaths(),
  ],
  test: {
    name: 'action-intention-test',
    globals: true,
    environment: 'jsdom',

    // This is correct and is the key to zoneless testing
    setupFiles: ['src/test-setup.ts'],
    reporters: ['default', 'html'],
    outputFile: {
      html: join(__dirname, '../../../dist/test-reports/apps/messenger/ng-action-intention/index.html'),
    },
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      reportsDirectory: '../../../coverage/apps/messenger/ng-action-intention',
      provider: 'v8',
    },
  },
});
