/**
 * @author Brave
 * @date 2026-09-18T17:49:29+08:00
 * @description Vite 构建配置，注册前端插件并代理开发环境 API 请求。
 */
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig({
  // Tailwind 负责工具类编译，Vue DevTools 仅在开发环境提供调试能力。
  plugins: [
    vue(),
    tailwindcss(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        cookiePathRewrite: {
          '^/auth': '/api/auth',
        },
      },
    },
  },
})
