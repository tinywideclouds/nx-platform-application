/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { join } from 'path';

// THIS IS NOW YOUR DEDICATED TEST CONFIG
export default defineConfig({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/llm/tools/model-registry',
  plugins: [
    angular({
      tsconfig: join(__dirname, 'tsconfig.test.json'),
    }),
    nxViteTsPaths(),
  ],
  test: {
    name: 'llm-tools-model-registry',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    reporters: ['default', 'html'],
    outputFile: {
      html: join(
        __dirname,
        '../../../../dist/test-reports/libs/llm/tools/model-registry/index.html',
      ),
    },
    coverage: {
      reportsDirectory: '../../../../coverage/libs/llm/tools/model-registry',
      provider: 'v8' as const,
    },
  },
});
