/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { join } from 'path';

// THIS IS NOW YOUR DEDICATED TEST CONFIG
export default defineConfig({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/apps/messenger/auth-flow-e2e',
  plugins: [angular(), nxViteTsPaths()],
  test: {
    name: 'chat-data-access',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    reporters: ['default', 'html'],
    outputFile: {
      html: join(
        __dirname,
        '../../../dist/test-reports/apps/messenger/auth-flow-e2e/index.html'
      ),
    },
    coverage: {
      reportsDirectory: '../../../coverage/apps/messenger/auth-flow-e2e',
      provider: 'v8' as const,
    },
  },
});
