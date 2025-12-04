const colors = require('tailwindcss/colors');

/** @type {import('tailwindcss').Config} */
module.exports = {
  // 1. Theme Extension
  // Define your shared design system here (Colors, Typography, Spacing).
  // These will be available in every app that imports this preset.
  theme: {
    extend: {
      colors: {
        // Example: Standardizing 'primary' across the monorepo
        primary: {
          ...colors.indigo,
          DEFAULT: colors.indigo[600],
        },
        secondary: colors.slate,
        // precise brand colors can go here
        brand: '#243c5a',
      },
      // Example: Shared spacing or border radius
      borderRadius: {
        xl: '1rem',
      },
    },
  },

  // 2. Shared Plugins
  // If you use forms or typography plugins, add them here so
  // all apps inherit them automatically.
  plugins: [
    // require('@tailwindcss/forms'),
    // require('@tailwindcss/typography'),
  ],
};
