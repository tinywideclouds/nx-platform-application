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
           * Allows deep imports ONLY for the two protos libraries and the test helpers in platform-auth-access/testing.
           */
          allow: [
            '@nx-platform-application/platform-protos/**',
            '@nx-platform-application/messenger-protos/**',
            '@nx-platform-application/platform-auth-access/testing',
            '@nx-platform-application/platform-auth-ui/mocks',
          ],
          /**
           * THE "GATEKEEPER"
           * These are the architectural zoning rules based on tags.
           */
          depConstraints: [
            // =========================================================
            // 1. SCOPE RULES (Vertical Boundaries)
            // =========================================================
            // Protos (Self-contained)
            {
              sourceTag: 'scope:protos-platform',
              onlyDependOnLibsWithTags: [],
            },
            {
              sourceTag: 'scope:protos-messenger',
              onlyDependOnLibsWithTags: [],
            },
            // Types ("Buddy System" - can see Protos)
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
            // Platform Scope
            {
              sourceTag: 'scope:platform',
              onlyDependOnLibsWithTags: [
                'scope:platform',
                'scope:types-platform',
              ],
            },
            // Contacts Scope (Can see Platform)
            {
              sourceTag: 'scope:contacts',
              onlyDependOnLibsWithTags: [
                'scope:contacts',
                'scope:platform',
                'scope:types-platform',
              ],
            },
            // Messenger Scope (Can see Contacts & Platform)
            {
              sourceTag: 'scope:messenger',
              onlyDependOnLibsWithTags: [
                'scope:messenger',
                'scope:contacts',
                'scope:platform',
                'scope:types-messenger',
                'scope:types-platform',
              ],
            },

            // =========================================================
            // 2. LAYER RULES (Horizontal Boundaries)
            // =========================================================
            {
              sourceTag: 'layer:ui',
              onlyDependOnLibsWithTags: [
                'layer:ui',
                'layer:state',
                // Allow Types (Layer 0)
                'scope:types-messenger',
                'scope:types-platform',
                'scope:types-contacts',
              ],
            },
            {
              sourceTag: 'layer:state',
              onlyDependOnLibsWithTags: [
                'layer:state',
                'layer:domain',
                // Allow Types
                'scope:types-messenger',
                'scope:types-platform',
                'scope:types-contacts',
              ],
            },
            {
              sourceTag: 'layer:domain',
              onlyDependOnLibsWithTags: [
                'layer:domain',
                'layer:infrastructure',
                // Allow Types
                'scope:types-messenger',
                'scope:types-platform',
                'scope:types-contacts',
              ],
            },
            {
              sourceTag: 'layer:infrastructure',
              onlyDependOnLibsWithTags: [
                'layer:infrastructure',
                // Allow Types
                'scope:types-messenger',
                'scope:types-platform',
                'scope:types-contacts',
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
