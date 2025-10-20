/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/auth-ui',

  plugins: [
    // The Angular plugin is essential for compiling your components.
    // The `jit: true` option aligns the compilation mode with the test environment.
    angular({}),

    // This Nx plugin is necessary for resolving tsconfig paths in a monorepo.
    nxViteTsPaths(),
  ],
  test: {
    name: 'auth-ui',
    globals: true,
    environment: 'jsdom',

    setupFiles: ['src/test-setup.ts'],
    reporters: ["default", "html"],

    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      reportsDirectory: '../../coverage/libs/auth-ui',
      provider: 'v8',
    },
  },
});
