import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

// THIS IS NOW YOUR DEDICATED BUILD CONFIG
export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/sdk-core',
  plugins: [
    nxViteTsPaths(),
    nxCopyAssetsPlugin(['*.md']),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
      pathsToAliases: false,
    }),
  ],

  // Configuration for building your library.
  build: {
    outDir: '../../dist/sdk-core',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: 'src/index.ts',
      name: 'sdk-core',
      fileName: 'index',
      formats: ['es' as const],
    },
    rollupOptions: {
      external: [],
    },
  },
}));
