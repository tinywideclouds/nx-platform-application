// libs/platform/ui-toolkit/vitest.config.mts

/// <reference types='vitest' />
import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { join } from 'path';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../../../node_modules/.vite/libs/platform/ng/ui-toolkit',

  plugins: [
    angular({tsconfig: join(__dirname, 'tsconfig.test.json'),}), 
    nxViteTsPaths()
  ],
  test: {
    name: 'ui-toolkit',
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    reporters: ['default', 'html'],
    outputFile: {
      html: join(
        __dirname,
        '../../../../dist/test-reports/platform/ng/ui-toolkit/index.html'
      ),
    },
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      reportsDirectory: '../../../../coverage/libs/platform/ng/ui-toolkit',
      provider: 'v8',
    },
  },
});
