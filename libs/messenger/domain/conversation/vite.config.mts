/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import path from 'path';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../../node_modules/.vite/libs/messenger/domain/conversation',
  plugins: [
    angular({
      tsconfig: path.join(__dirname, 'tsconfig.lib.json'),
    }),
    nxViteTsPaths(),
    nxCopyAssetsPlugin(['*.md']),
  ],
  build: {
    emptyOutDir: true,
    lib: {
      entry: 'src/index.ts',
      name: 'domain/conversation',
      fileName: (format: any) => `index.${format}.js`,
      formats: ['es' as const],
    },
    // You also must externalize your dependencies
    rollupOptions: {
      external: [
        '@angular/core',
        '@angular/common/http',
        'rxjs',
        '@nx-platform-application/platform-types', // From your README.md
      ],
    },
  },
}));
