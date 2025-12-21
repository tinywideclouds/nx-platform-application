// libs/platform/lifecycle/vitest.config.mts

/// <reference types='vitest' />
import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { join } from 'path';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../../../node_modules/.vite/libs/platform/ng/lifecycle',

  plugins: [
    angular({ tsconfig: join(__dirname, 'tsconfig.test.json') }),
    nxViteTsPaths(),
  ],
  test: {
    name: 'lifecycle',
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    reporters: ['default', 'html'],
    outputFile: {
      html: join(
        __dirname,
        '../../../../dist/test-reports/platform/ng/lifecycle/index.html',
      ),
    },
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      reportsDirectory: '../../../../coverage/libs/platform/ng/lifecycle',
      provider: 'v8',
    },
  },
});
