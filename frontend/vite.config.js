import { defineConfig } from 'vite';
import fs from 'fs';
import { resolve } from 'path';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const isDev = process.env.NODE_ENV === 'development';

export default defineConfig({
  root: resolve(__dirname, 'src'),
  publicDir: resolve(__dirname, 'public'),
  build: {
    target: 'esnext',
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: true
  },
  server: isDev
  ? {
    host: '0.0.0.0',
    port: 5173,
    https: {
      key: fs.readFileSync(resolve(__dirname, 'certs/server.key')),
      cert: fs.readFileSync(resolve(__dirname, 'certs/server.crt')),
    },
    hmr: {
      protocol: 'wss',
      host: 'localhost',
      port: 5173
    },
    proxy: {
      '/api/pong/wss': {
        target: 'https://pong-service:3003',
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path.replace(/^\/api\/pong\/wss/, '/wss')
      },
      '/api/pong/ws': {
        target: 'https://pong-service:3003',
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path.replace(/^\/api\/pong\/ws/, '/ws')
      },
      '/api': {
        target: 'https://api-gateway:3000/',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      '/avatars': {
        target: 'https://api-gateway:3000/',
        changeOrigin: true,
        secure: false,
      },
    }
  } : undefined,
  css: {
    postcss: {
      plugins: [tailwindcss, autoprefixer]
    }
  }
});
