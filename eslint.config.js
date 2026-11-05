import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Raw benchmark runs are kept as the agents left them (evidence), not linted.
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'coverage/**',
      'fixtures/**',
      'docs/benchmarks/runs/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // The shipped packages must stay dependency-free and DOM-free (core) at the source level.
    files: ['packages/core/src/**/*.ts', 'modules/*/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ regex: '^(?!\\.)', message: 'core imports only its own modules.' }] },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'performance', 'Date'],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'core is deterministic.' },
      ],
    },
  },
);
