// apps/contacts/layout-demo-app/vitest.config.mts

/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { join } from 'path';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/apps/contacts/layout-demo-app',

  plugins: [angular(), nxViteTsPaths()],

  test: {
    name: 'layout-demo-app',
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    reporters: ['default', 'html'],
    outputFile: {
      html: join(
        __dirname,
        '../../../dist/test-reports/apps/contacts/layout-demo-app/index.html'
      ),
    },
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      reportsDirectory: '../../../coverage/apps/contacts/layout-demo-app',
      provider: 'v8' as const,
    },
  },
});