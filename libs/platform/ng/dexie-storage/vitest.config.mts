/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { join } from 'path';

// THIS IS NOW YOUR DEDICATED TEST CONFIG
export default defineConfig({
  root: __dirname,
  cacheDir: '../../../../node_modules/.vite/libs/platform/ng/dexie-storage',
  plugins: [
    angular({
      tsconfig: join(__dirname, 'tsconfig.test.json'),
    }),
    nxViteTsPaths()
  ],
  test: {
    name: 'platform-dexie-storage',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    reporters: ['default', 'html'],
    outputFile: {
      html: join(
        __dirname,
        '../../../../dist/test-reports/platform/ng/platform/ng/dexie-storage/index.html'
      ),
    },
    coverage: {
      reportsDirectory:
        '../../../../coverage/libs/platform/ng/platform/ng/dexie-storage',
      provider: 'v8' as const,
    },
  },
});
