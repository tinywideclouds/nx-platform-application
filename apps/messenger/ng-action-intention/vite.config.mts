import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/apps/messenger/ng-action-intention',
  plugins: [angular(), nxViteTsPaths()],
  build: {
    outDir: '../../../dist/apps/messenger/ng-action-intention',
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  server: {
    port: 4200,
    host: 'localhost',
  },
  preview: {
    port: 4300,
    host: 'localhost',
  },
});
