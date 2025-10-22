// Create this new file: libs/messenger/contacts-ui/vitest.config.mts

/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import {join} from "path";

export default defineConfig({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/messenger/contacts-ui',

  plugins: [
    angular({  }),

    nxViteTsPaths()
  ],

  test: {
    name: 'contacts-ui',
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    reporters: ['default', 'html'],
    outputFile: {
      html: join(__dirname, '../../../dist/test-reports/contacts-ui/index.html'),
    },
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/messenger/contacts-ui',
      provider: 'v8' as const,
    },
  },
});
