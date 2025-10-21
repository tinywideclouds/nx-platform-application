/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/platform/auth-data-access',
  plugins: [angular(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],

  build: {
    outDir: '../../dist/platform-types',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: 'src/index.ts',
      name: 'auth-data-access',
      fileName: 'index',
      formats: ['es' as const],
    },
    rollupOptions: {
      // Externalize dependencies that should not be bundled into your library.
      // This is crucial for libraries.
      external: [
        '@angular/core',
        '@angular/common',
        '@angular/common/http',
        'rxjs',
        'vitest', // Must externalize vitest from the mock service
        /@nx-platform-application\/.*/, // Externalize all other workspace libs
      ],
    },
  }
}));
