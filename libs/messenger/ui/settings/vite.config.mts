/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../../node_modules/.vite/libs/messenger/ui/settings',
  plugins: [angular(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],

  build: {
    outDir: '../../../../dist/libs/messenger/ui/settings',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    // This tells Vite to build a library, not an app
    lib: {
      entry: 'src/index.ts',
      name: 'messenger-settings-ui',
      fileName: 'index',
      formats: ['es' as const],
    },
  },
}));
