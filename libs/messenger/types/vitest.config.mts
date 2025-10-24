/// <reference types='vitest' />
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

// THIS IS NOW YOUR DEDICATED TEST CONFIG
export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/messenger/types',
  plugins: [
    nxViteTsPaths()
  ],
  test: {
    name: 'messenger-types',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/messenger/types',
      provider: 'v8' as const,
    },
    // setupFiles: ['src/test-setup.ts'],
  },
}));
