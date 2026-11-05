import tseslint from 'typescript-eslint'

export default [
  { ignores: ['**/dist/**', '**/src/database/generated/**'] },
  ...tseslint.configs.recommended,
]
