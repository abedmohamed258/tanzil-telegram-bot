const tseslint = require('typescript-eslint');

module.exports = tseslint.config({
  files: ['**/*.ts'],
  ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'temp/**'],
  extends: [
    tseslint.configs.recommended,
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { 'argsIgnorePattern': '^_', 'varsIgnorePattern': '^_', 'caughtErrorsIgnorePattern': '.' }],
    '@typescript-eslint/no-require-imports': 'off',
  },
});
