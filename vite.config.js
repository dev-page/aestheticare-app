import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router')) {
            return 'vue-core'
          }

          if (id.includes('firebase')) {
            return 'firebase'
          }

          if (
            id.includes('sweetalert2') ||
            id.includes('vue3-toastify') ||
            id.includes('toastify-js') ||
            id.includes('@iconify')
          ) {
            return 'ui'
          }

          if (id.includes('chart.js')) {
            return 'charts'
          }

          if (id.includes('html5-qrcode') || id.includes('qrcode')) {
            return 'scanners'
          }

          if (id.includes('axios')) {
            return 'http'
          }
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/upload': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/send-otp': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  }
})
