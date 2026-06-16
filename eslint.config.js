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

  // App + library code (the deployable site in docs/) runs in the browser.
  {
    files: ['docs/app.js', 'docs/src/**/*.js'],
    languageOptions: { globals: { ...globals.browser } },
  },

  // Tests run under Node's built-in test runner.
  {
    files: ['test/**/*.js'],
    languageOptions: { globals: { ...globals.node } },
  },

  // E2E tests run under Node but also evaluate code in the browser context.
  {
    files: ['e2e/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },

  // Turn off rules that conflict with Prettier (keep ESLint about correctness).
  prettier,
];
