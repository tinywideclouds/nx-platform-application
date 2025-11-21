// In libs/platform/auth-access/vite.config.mts
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import * as path from 'path';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../../node_modules/.vite/libs/platform/auth-access',
  plugins: [
    // 2. Tell the plugin to use your library tsconfig for the build
    angular({
      tsconfig: path.join(__dirname, 'tsconfig.lib.json'),
    }),
    nxViteTsPaths(),
    nxCopyAssetsPlugin(['*.md']),
  ],

  build: {
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: {
        index: 'src/index.ts',
        testing: 'src/testing.ts'
      },
      name: 'auth-access',
      fileName: 'index',
      formats: ['es' as const],
    },
  },
}));
