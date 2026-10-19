// Flat config (ESLint 10). Project rules from CLAUDE.md are enforced here where a linter can do it.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'apps/api/src/generated/**',
      'apps/mobile/.expo/**',
      'apps/mobile/expo-env.d.ts',
      'apps/mobile/nativewind-env.d.ts',
      '**/*.config.{js,cjs,mjs}',
      'apps/mobile/babel.config.js',
      'apps/mobile/metro.config.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
    },
  },
  {
    // Nest DI relies on runtime class references in constructor parameters.
    files: ['apps/api/**/*.ts'],
    rules: { '@typescript-eslint/consistent-type-imports': 'off' },
  },
  {
    // "No Prisma outside repositories" (CLAUDE.md).
    files: ['apps/api/src/**/*.ts'],
    ignores: [
      'apps/api/src/**/repositories/**',
      'apps/api/src/infrastructure/database/**',
      'apps/api/src/**/*.spec.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@prisma/*', '**/generated/prisma*'],
              message: 'Prisma is only allowed in repositories.',
            },
          ],
        },
      ],
    },
  },
  {
    // Domain functions are pure and receive `now` (CLAUDE.md).
    files: ['apps/api/src/**/domain/**/*.ts', 'packages/shared/src/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Pass `now` in; do not read the clock.',
        },
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'Pass `now` in; do not read the clock.',
        },
      ],
    },
  },
  {
    files: ['apps/admin/**/*.{ts,tsx}', 'apps/mobile/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
);
