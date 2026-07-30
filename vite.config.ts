import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import {
  createRegion5RuntimeCacheRule,
  createRegion5SetCacheRule,
  createRegion6RuntimeCacheRule,
  createRegion6SetCacheRule,
  createRegion7RuntimeCacheRule,
  createRegion7SetCacheRule,
} from './pwa-region-cache';

// GitHub Pages 部署在 https://1449690477.github.io/yingrenchuanshuo/
// base 必须与仓库名一致，否则线上资源全部 404。
export default defineConfig({
  base: '/yingrenchuanshuo/',
  plugins: [
    vue(),
    VitePWA({
      // 让新 Service Worker 先等待，由应用内提示明确触发切换与整页刷新。
      // autoUpdate 会让新 SW 立即清掉旧缓存，但旧页面仍可能继续运行已经删除的
      // 入口 JS，随后在动态加载联机模块时形成「旧壳 + 新缓存」的半更新状态。
      registerType: 'prompt',
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
          'assets/maps/r{3,4,5,6,7}.webp',
          'assets/maps/chapter-{3,4,5,6,7}-*.webp',
          'assets/battlefields/chapter-{3,4,5,6,7}-*.webp',
          'assets/monsters/{r3,r4,r5,r6,r7}/**',
          'assets/equipment/{r3,r4,r5,r6,r7}/**',
          'assets/equipment/sets/r5-crimson/**',
          'assets/equipment/sets/r6-shadow/**',
          'assets/equipment/sets/r7-bloodmoon/**',
        ],
        runtimeCaching: [
          // 必须排在通用 modular 路由之前，否则 Workbox 首个命中会把 R5
          // 换装层塞进 character-appearance，独立容量契约形同虚设。
          createRegion5RuntimeCacheRule(),
          createRegion5SetCacheRule(),
          createRegion6RuntimeCacheRule(),
          createRegion6SetCacheRule(),
          createRegion7RuntimeCacheRule(),
          createRegion7SetCacheRule(),
          {
            urlPattern: ({ url }) =>
              /\/assets\/maps\/(?:r[34]|chapter-[34]-\d)\.webp$/.test(url.pathname) ||
              /\/assets\/battlefields\/chapter-[34]-\d\.webp$/.test(url.pathname) ||
              /\/assets\/(?:monsters|equipment)\/r[34]\//.test(url.pathname) ||
              /\/assets\/characters\/modular\/(?:swordsman|witch|shaman|catkin)\/r[34]-(?:body|head|weapon)\.png$/.test(
                url.pathname,
              ),
            handler: 'CacheFirst',
            options: {
              cacheName: 'region-content-v1',
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 128,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
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
