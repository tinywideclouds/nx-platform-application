/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { join } from 'path';

// THIS IS NOW YOUR DEDICATED TEST CONFIG
export default defineConfig({
  root: __dirname,
  cacheDir:
    '../../../node_modules/.vite/libs/messenger/messenger-crypto-access',
  plugins: [angular(), nxViteTsPaths()],
  test: {
    name: 'messenger-crypto-access',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    reporters: ['default', 'html'],
    outputFile: {
      html: join(
        __dirname,
        '../../../dist/test-reports/libs/messenger/messenger-crypto-access/index.html'
      ),
    },
    coverage: {
      reportsDirectory:
        '../../../coverage/libs/messenger/messenger-crypto-access',
      provider: 'v8' as const,
    },
  },
});
