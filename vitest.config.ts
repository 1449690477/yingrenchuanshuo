import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // 多个 Sharp/libvips 资产审计并行会争抢原生内存；限制 worker 保证本地与 CI 可复现。
    maxWorkers: 2,
    environment: 'node',
    include: ['src/**/__tests__/**/*.spec.ts'],
  },
});
