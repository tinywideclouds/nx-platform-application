import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig(({ mode }) => ({
  root: __dirname,
  cacheDir: `<%= offsetFromRoot %>node_modules/.vite/<%= projectRoot %>`,
  plugins: [angular(), nxViteTsPaths()],
  build: {
    outDir: `<%= offsetFromRoot %>dist/<%= projectRoot %>`,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
}));
