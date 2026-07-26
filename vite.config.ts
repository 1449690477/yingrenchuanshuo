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
      includeAssets: ['favicon.svg'],
      manifest: {
        name: '樱刃传说',
        short_name: '樱刃传说',
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
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
