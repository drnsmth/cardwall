import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  // Don't lint dependencies or generated reports.
  { ignores: ['node_modules/**', 'coverage/**', 'report/**'] },

  js.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },

  // App + library code runs in the browser.
  {
    files: ['app.js', 'src/**/*.js'],
    languageOptions: { globals: { ...globals.browser } },
  },

  // Tests run under Node's built-in test runner.
  {
    files: ['test/**/*.js'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Turn off rules that conflict with Prettier (keep ESLint about correctness).
  prettier,
];
