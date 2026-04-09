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
  server: {
    proxy: {
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
