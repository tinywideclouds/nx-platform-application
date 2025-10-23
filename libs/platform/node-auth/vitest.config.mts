import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '../../../node_modules/.vitest',
  plugins: [nxViteTsPaths()],
  test: {
    globals: true,
    // [FIXED] Force 'node' environment, as we confirmed.
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/platform/node-auth',
      provider: 'v8',
    },
  },
});
