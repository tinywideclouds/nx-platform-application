// --- FILE: libs/messenger/chat-state/vite.config.mts ---
// (REFACTORED - FULL CODE)

/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/libs/messenger/chat-state',
  plugins: [angular(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'chat-state',
      fileName: (format: any) => `index.${format}.js`,
      formats: ['es' as const],
    },
    // You also must externalize your dependencies
    rollupOptions: {
      external: [
        // Angular and RxJS
        '@angular/core',
        '@angular/common',
        'rxjs',

        // Polyfills
        '@js-temporal/polyfill',

        // Other @nx-platform-application libs
        '@nx-platform-application/console-logger',
        '@nx-platform-application/platform-types',
        '@nx-platform-application/platform-auth-access',
        '@nx-platform-application/messenger-crypto-bridge',
        '@nx-platform-application/messenger-key-access',
        '@nx-platform-application/messenger-key-cache',
        '@nx-platform-application/messenger-types',
        '@nx-platform-application/chat-storage',
        '@nx-platform-application/chat-live-data',
        '@nx-platform-application/chat-access',
      ],
    },
  },
}));
