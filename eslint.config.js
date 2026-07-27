import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'dev-dist/**',
      'tmp/**',
      'scripts/out/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },

  // UI 与 store 层跑在浏览器里
  {
    files: ['src/**/*.{ts,vue}'],
    languageOptions: { globals: globals.browser },
  },

  // 构建脚本与配置文件跑在 Node 里，需要 Node 全局变量
  {
    files: ['scripts/**', '*.config.{js,ts,mjs}'],
    languageOptions: {
      globals: {
        Buffer: 'readonly',
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
  },

  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'vue/multi-word-component-names': 'off',
    },
  },

  // ───────────────────────────────────────────────────────────
  // 架构铁律 1（见 AGENTS.md）：core 层必须是纯逻辑
  // 禁止 src/core 依赖 UI 框架、DOM、存储实现
  // ───────────────────────────────────────────────────────────
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'vue', message: 'core 层禁止依赖 Vue —— 见 AGENTS.md 铁律 1' },
            { name: 'pinia', message: 'core 层禁止依赖 Pinia —— 见 AGENTS.md 铁律 1' },
            { name: 'idb', message: 'core 层禁止依赖存储实现 —— 见 AGENTS.md 铁律 1' },
          ],
          patterns: [
            {
              group: ['@/stores/*', '@/views/*', '@/components/*', '@/save/*'],
              message: 'core 层只能被上层调用，不能反向依赖',
            },
          ],
        },
      ],
      // 铁律 4：随机必须可复现
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: '禁止 Math.random()，请使用 core/rng.ts —— 见 AGENTS.md 铁律 4',
        },
      ],
    },
  },

  // data 层只放数据，不放逻辑
  {
    files: ['src/data/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/stores/*', '@/views/*', '@/components/*'],
              message: 'data 层是纯配置，不得依赖上层',
            },
          ],
        },
      ],
    },
  },

  prettier,
);
