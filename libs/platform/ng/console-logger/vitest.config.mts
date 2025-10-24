/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { join } from 'path';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../../../node_modules/.vite/libs/platform/ng/console-logger',
  plugins: [angular(), nxViteTsPaths()],
  test: {
    name: 'console-logger',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    reporters: ['default', 'html'],
    outputFile: {
      html: join(
        __dirname,
        '../../../../dist/test-reports/libs/platform/ng/console-logger/index.html'
      ),
    },
    coverage: {
      reportsDirectory: '../../../../coverage/libs/platform/ng/console-logger',
      provider: 'v8' as const,
    },
  },
});
