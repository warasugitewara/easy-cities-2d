import { defineConfig } from 'vite'

export default defineConfig({
  base: '/easy-cities-2d/',
  server: {
    port: 5173,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'esnext',
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  esbuild: {
    drop: ['console', 'debugger'],
    target: 'esnext',
  },
})
