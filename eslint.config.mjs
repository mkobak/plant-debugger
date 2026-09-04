import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      'prefer-const': 'error',
      // These react-hooks v7 rules encode React Compiler constraints. The app
      // does not use the compiler, and its hydration-restore and typing
      // animation effects intentionally set state inside effects. Revisit
      // when adopting the compiler.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
    },
  },
  {
    // Tests, mocks and Node scripts: CommonJS requires (post-doMock
    // imports) and loose typing of fixtures are fine here
    files: [
      'src/__tests__/**',
      '__mocks__/**',
      'scripts/**',
      'jest.config.js',
      'jest.setup.js',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'next-env.d.ts',
    'public/images/*.svg',
  ]),
]);
