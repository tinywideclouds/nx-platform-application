/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir:
    '../../../node_modules/.vite/libs/messenger/messenger-crypto-bridge',
  plugins: [angular(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],

  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'messenger-crypto-bridge',
      fileName: (format: any) => `index.${format}.js`,
      formats: ['es' as const],
    },
    // You also must externalize your dependencies
    rollupOptions: {
      external: [
        '@angular/core',
        '@angular/common/http',
        'rxjs',
        '@nx-platform-application/messenger-types',
      ],
    },
  },
}));
