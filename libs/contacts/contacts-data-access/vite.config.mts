// libs/contacts/contacts-data-access/vite.config.mts

import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import dts from 'vite-plugin-dts'; // 1. Import dts for type definitions

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/contacts/contacts-data-access',
  plugins: [
    angular({
      tsconfig: 'tsconfig.lib.json',
    }),
    nxViteTsPaths(),
    nxCopyAssetsPlugin(['*.md']),
    // 3. Add the dts plugin to generate type files
    dts({
      entryRoot: 'src',
      tsconfigPath: 'tsconfig.lib.json',
    }),
  ],

  // 4. ADD THIS BUILD CONFIGURATION
  build: {
    emptyOutDir: true,
    reportCompressedSize: true,
    lib: {
      entry: 'src/index.ts', // This is the library entry point
      fileName: 'index',
      formats: ['es' as const],
    },
  },
}));
