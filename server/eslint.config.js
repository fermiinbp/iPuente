// Reglas de ESLint para Node.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import globals from 'globals';

export default defineConfig([
  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      // Los middlewares de Express reciben (req, res, next) aunque no usen todos.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_|^next$' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['scripts/**/*.js'],
    rules: { 'no-console': 'off' },
  },
  // Siempre el último: apaga las reglas de formato que ya gestiona Prettier.
  prettier,
]);
