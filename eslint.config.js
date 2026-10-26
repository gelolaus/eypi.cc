import eslint from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import pluginVueA11y from 'eslint-plugin-vuejs-accessibility'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['dist/**', 'backend/worker-configuration.d.ts'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  ...pluginVueA11y.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    // Vendored shadcn-style primitives (src/components/ui). Their single-word names, pass-through
    // props and empty prop interfaces mirror upstream, and form primitives cannot know their label:
    // the consuming view supplies it, and that view is linted.
    files: ['src/components/ui/**/*.{ts,vue}'],
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/require-default-prop': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'vuejs-accessibility/form-control-has-label': 'off',
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['src/**/*.{ts,vue}', 'worker/**/*.ts'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['**/*.{ts,vue}'],
    rules: {
      // TypeScript already checks undefined names. `no-undef` flags DOM types such as ScrollBehavior.
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      // A label is associated if it nests its control or points at it with `for`.
      // The plugin default requires both, which rejects a correct `for`/`id` pair.
      'vuejs-accessibility/label-has-for': ['error', {
        required: { some: ['nesting', 'id'] },
      }],
    },
  },
)
