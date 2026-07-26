import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.spec.ts'],
    // M0 阶段尚无测试。M1-2 写下第一个 rng 测试后，请删除这一行。
    passWithNoTests: true,
  },
});
