import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

// Module boundaries (ADR-001/003, decisions/architect/mvp.md):
// engine + export are pure TS — no React, no DOM-bound modules, no UI/app imports.
const pureDomainRestrictions = {
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: ['react', 'react-dom', 'react/*', 'zustand'],
          message: 'Domain modules must stay framework-free.',
        },
        {
          group: ['**/ui/**', '**/app/**', '**/preview/**', '**/scopes/**', '**/io/**'],
          message: 'Domain modules may not depend on UI/app/IO layers.',
        },
      ],
    },
  ],
}

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2023, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/engine/**/*.ts', 'src/export/**/*.ts'],
    rules: { ...pureDomainRestrictions, '@typescript-eslint/no-explicit-any': 'error' },
  },
  {
    // engine may import only engine; export may import engine types.
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/export/**',
                '**/ui/**',
                '**/app/**',
                '**/preview/**',
                '**/scopes/**',
                '**/io/**',
                'react',
                'react-dom',
                'zustand',
              ],
              message: 'engine is a leaf module (ADR-002).',
            },
          ],
        },
      ],
    },
  },
)
