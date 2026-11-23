/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const page = (path: string) => resolve(import.meta.dirname, path);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5174 },
  preview: { port: 5174 },
  build: {
    // One HTML file per page, so any static host serves /about/ and /bugs/ without rewrites.
    rollupOptions: {
      input: {
        games: page('index.html'),
        about: page('about/index.html'),
        bugs: page('bugs/index.html'),
      },
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
  },
});
