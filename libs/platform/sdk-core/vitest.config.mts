import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

// THIS IS NOW YOUR DEDICATED TEST CONFIG
export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/platform/sdk-core',
  plugins: [
    nxViteTsPaths()
  ],
  test: {
    name: 'sdk-core',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/platform/sdk-core',
      provider: 'v8' as const,
    },
    // Add setupFiles here if your sdk needs one
    setupFiles: ['src/test-setup.ts'],
  },
}));
