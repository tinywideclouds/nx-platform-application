/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import dts from 'vite-plugin-dts';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/contacts/domain/service',
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
      // Don't bundle these; expect the App to provide them
      external: [
        // Frameworks
        '@angular/core',
        '@angular/common',
        'rxjs',
        'rxjs/operators',

        // Third Party
        '@js-temporal/polyfill',

        // Internal Nx Libs
        '@nx-platform-application/platform-types',
        '@nx-platform-application/contacts-types',
        '@nx-platform-application/contacts-infrastructure-storage',
        '@nx-platform-application/platform-tools-console-logger',
      ],
    },
  },
}));
