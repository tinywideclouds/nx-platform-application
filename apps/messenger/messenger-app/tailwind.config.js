const { createGlobPatternsForDependencies } = require('@nx/angular/tailwind');
const { join } = require('path');

// 1. Load the central tsconfig to find the "source of truth" for paths
const tsConfig = require('../../../tsconfig.base.json');

/**
 * Helper to resolve a library's path from tsconfig alias.
 * This eliminates the need for brittle relative paths like '../../libs/...'
 */
function getLibPath(alias) {
  // Get the path defined in tsconfig (e.g., "libs/contacts/contacts-ui/src/index.ts")
  const libPath = tsConfig.compilerOptions.paths[alias]?.[0];

  if (!libPath) {
    throw new Error(
      `Could not find path for alias '${alias}' in tsconfig.base.json`
    );
  }

  // Convert "src/index.ts" -> "src" to prepare for the glob pattern
  // We use process.cwd() because Nx commands run from the workspace root
  return join(process.cwd(), libPath.replace('/index.ts', ''));
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),

    // 2. Automatically scan direct dependencies (includes messenger-ui)
    ...createGlobPatternsForDependencies(__dirname),

    // 3. Explicitly add the transitive buildable dependency using the robust helper
    join(
      getLibPath('@nx-platform-application/contacts-ui'),
      '**/!(*.stories|*.spec).{ts,html}'
    ),
    join(
      getLibPath('@nx-platform-application/messenger-ui'),
      '**/!(*.stories|*.spec).{ts,html}'
    ),
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
