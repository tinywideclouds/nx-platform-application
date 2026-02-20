import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import dts from 'vite-plugin-dts';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/llm/core',
  plugins: [
    angular({
      tsconfig: 'tsconfig.lib.json',
    }),
    nxViteTsPaths(),
    nxCopyAssetsPlugin(['*.md']),
    dts({
      entryRoot: 'src',
      tsconfigPath: 'tsconfig.lib.json',
    }),
  ],

  build: {
    emptyOutDir: true,
    reportCompressedSize: true,
    lib: {
      entry: 'src/index.ts',
      fileName: 'index',
      formats: ['es' as const],
    },
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      // EXTERNALIZE DEPENDENCIES
      external: [
        // 1. Angular & RxJS Framework
        '@angular/core',
        '@angular/common',
        '@angular/router',
        '@angular/forms',
        'rxjs',
        'rxjs/operators',

        // 3. Shared Types (if used directly in components)
        '@nx-platform-application/llm-types',
      ],
    },
  },
}));
