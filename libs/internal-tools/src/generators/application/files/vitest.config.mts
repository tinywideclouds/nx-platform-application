/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  root: __dirname,
  cacheDir: `<%= offsetFromRoot %>node_modules/.vite/<%= projectRoot %>`,
  plugins: [
    angular({}),
    nxViteTsPaths(),
  ],
  test: {
    name: '<%= name %>-test',
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    reporters: ['default', 'html'],
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      reportsDirectory: `<%= offsetFromRoot %>coverage/<%= projectRoot %>`,
      provider: 'v8',
    },
  },
});
