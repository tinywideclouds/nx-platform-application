// In libs/platform/console-logger/vite.config.mts
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import * as path from 'path';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../../node_modules/.vite/libs/platform/ng/console-logger',
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
      entry: 'src/index.ts',
      name: 'console-logger',
      fileName: 'index',
      formats: ['es' as const],
    },
  },
}));
