const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  // 1. Inherit from the shared preset
  presets: [require('../../../tailwind.preset.js')],

  // 2. THE STABILITY FIX:
  // Instead of asking Nx which libs are used, we scan the entire 'libs' directory.
  // This guarantees that ANY component created in ANY lib will have styles generated.
  // It removes the reliance on the dependency graph, aliases, or build order.
  content: [
    join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
    join(__dirname, '../../../libs/**/!(*.stories|*.spec).{ts,html}'),
  ],
};
