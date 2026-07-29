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
      // Supabase Edge Function 是 Deno 代码（Deno 全局），不在本仓 TS/浏览器规则内
      'supabase/**',
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

  // 构建脚本与配置文件跑在 Node 里，需要 Node 全局变量。
  //
  // ⚠ 这里必须用 globals.node 整套，不要手写白名单。
  // 早期只列了 Buffer/console/process/__dirname/__filename 五个，
  // 等 scripts/ 里出现常驻服务（聊天室、广播桥接）后立刻不够用了 ——
  // setInterval / setTimeout / fetch / WebSocket 全是 Node 18+ 的合法全局，
  // 却被报成 no-undef，一度把所有人的 npm run verify 卡死。
  {
    files: ['scripts/**', '*.config.{js,ts,mjs}'],
    languageOptions: { globals: globals.node },
  },

  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'vue/multi-word-component-names': 'off',
      // 「尽力而为、失败不管」的 catch {} 是常驻服务里的正当写法
      // （心跳应答、断线清理），不该逼着每处都写一行占位注释。
      'no-empty': ['error', { allowEmptyCatch: true }],
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
