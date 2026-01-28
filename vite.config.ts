import { defineConfig } from 'vite'

export default defineConfig({
  base: '/easy-cities-2d/',
  server: {
    port: 5173,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
