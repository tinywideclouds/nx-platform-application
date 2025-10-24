import { defineConfig } from 'vitest/config';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { join } from "path";
import angular from '@analogjs/vite-plugin-angular';

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
    outputFile: {
      html: join(__dirname, '<%= offsetFromRoot %>/dist/test-reports/<%= projectRoot %>/index.html'),
    },
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      reportsDirectory: `<%= offsetFromRoot %>coverage/<%= projectRoot %>`,
      provider: 'v8',
    },
  },
});
