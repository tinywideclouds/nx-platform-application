import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import * as path from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir:
    '../../../../node_modules/.vite/libs/messenger/infrastructure/key-storage',
  plugins: [
    angular(),
    nxViteTsPaths(),
    nxCopyAssetsPlugin(['*.md']),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
    }),
  ],
  build: {
    outDir: '../../../../dist/libs/messenger/infrastructure/key-storage',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: 'src/index.ts',
      name: 'messenger-key-storage',
      fileName: 'index',
      formats: ['es' as const],
    },
  },
}));
