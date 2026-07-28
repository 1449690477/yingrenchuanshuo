import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// GitHub Pages 部署在 https://1449690477.github.io/yingrenchuanshuo/
// base 必须与仓库名一致，否则线上资源全部 404。
export default defineConfig({
  base: '/yingrenchuanshuo/',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-32.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: '樱刃传说',
        short_name: '樱刃传说',
        lang: 'zh-CN',
        description: '二次元竖版放置类传奇',
        theme_color: '#f2f8ff',
        background_color: '#f2f8ff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/yingrenchuanshuo/',
        scope: '/yingrenchuanshuo/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        // 换装层会随区域持续增长，不应全部塞进首次安装包。
        globIgnores: [
          'assets/characters/modular/**',
          'assets/dungeons/equipment/**',
          'assets/monsters/equipment-dungeon/**',
          'assets/equipment/dungeon/**',
          'assets/encounters/**',
        ],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/assets/characters/modular/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'character-appearance-v1',
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 160,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.pathname.includes('/assets/dungeons/equipment/') ||
              url.pathname.includes('/assets/monsters/equipment-dungeon/') ||
              url.pathname.includes('/assets/equipment/dungeon/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'equipment-dungeon-art-v1',
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 112,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.includes('/assets/encounters/'),
            // 奇遇美术会在保持稳定剧情路径的同时持续重绘；先回缓存、后台刷新，
            // 避免 CacheFirst 把同路径旧图钉住 30 天。
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'encounter-galgame-art-v1',
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 56,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
