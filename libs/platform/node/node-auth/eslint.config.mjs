import nx from '@nx/eslint-plugin';
import baseConfig from '../../../../eslint.config.mjs';

export default [
  ...baseConfig,
  // You might want to include a ruleset for typescript/node
  // but just extending the base is the simplest fix.
];
