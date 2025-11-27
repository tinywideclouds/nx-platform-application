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

const colors = require('tailwindcss/colors');

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
    extend: {
      keyframes: {
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.5)' },
          '90%': { opacity: '.9', transform: 'scale(1.1)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        // Name: 'pop-in', Duration: 0.3s (300ms), Easing: ease-out
        'pop-in': 'pop-in 0.3s ease-out forwards',
      },
      colors: {
        // Map Tailwind's 'primary' to Angular Material's Primary color
        primary: 'var(--mat-sys-primary)',
        'on-primary': 'var(--mat-sys-on-primary)',

        // Map Secondary / Tertiary
        secondary: colors.teal,
        tertiary: 'var(--mat-sys-tertiary)',

        // Map Backgrounds and Surfaces
        surface: 'var(--mat-sys-surface)',
        'on-surface': 'var(--mat-sys-on-surface)',
        background: 'var(--mat-sys-background)',

        // Error states
        error: 'var(--mat-sys-error)',
      },
      // Optional: Extend font family to match Material
      fontFamily: {
        sans: ['Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
