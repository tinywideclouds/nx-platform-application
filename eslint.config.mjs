import nx from '@nx/eslint-plugin';

export default [
  {
    files: ['**/*.json'],
    // Override or add rules here
    rules: {},
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
  // 1. Includes Nx's base, TypeScript, and JavaScript flat configs
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  // 2. Default ignores
  {
    ignores: [
      '**/dist',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
    ],
  },
  // 3. Main rules block
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          /**
           * THE "SPECIAL PERMIT"
           * Allows deep imports ONLY for the two protos libraries and the test helpers in platform-auth-data-access/testing.
           * This rule doesn't grant access; it just bypasses the barrel file (`index.ts`) check.
           */
          allow: [
            '@nx-platform-application/platform-protos/**',
            '@nx-platform-application/messenger-protos/**',
            '@nx-platform-application/platform-auth-data-access/testing',
          ],
          /**
           * THE "GATEKEEPER"
           * These are the architectural zoning rules based on tags.
           */
          depConstraints: [
            // --- Protos Rules (Self-contained) ---
            {
              sourceTag: 'scope:protos-platform',
              onlyDependOnLibsWithTags: [],
            },
            {
              sourceTag: 'scope:protos-messenger',
              onlyDependOnLibsWithTags: [],
            },
            // --- Types Rules ("Buddy System") ---
            {
              sourceTag: 'scope:types-platform',
              onlyDependOnLibsWithTags: ['scope:protos-platform'],
            },
            {
              sourceTag: 'scope:types-messenger',
              onlyDependOnLibsWithTags: [
                'scope:protos-messenger',
                'scope:types-platform',
              ],
            },
            // --- Existing App/Feature Rules (Updated) ---
            // Platform projects can now depend on platform-types, but NOT protos directly.
            {
              sourceTag: 'scope:platform',
              onlyDependOnLibsWithTags: [
                'scope:platform',
                'scope:types-platform',
              ],
            },
            // Messenger projects can depend on its types and platform, but NOT protos directly.
            {
              sourceTag: 'scope:messenger',
              onlyDependOnLibsWithTags: [
                'scope:messenger',
                'scope:platform',
                'scope:types-messenger',
                'scope:types-platform',
              ],
            },
          ],
        },
      ],
    },
  },
  // 4. Additional file overrides
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    rules: {},
  },
];
