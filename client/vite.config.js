import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@shared': path.resolve(__dirname, '../shared') } },
  server: {
    port: 5173,
    fs: { allow: ['..'] },
    proxy: { '/v1': 'http://localhost:4000', '/uploads': 'http://localhost:4000' },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
