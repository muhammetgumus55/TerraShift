/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// Arksus farmer site. The contract data lives in public/data (written by the
// engine: `make data`), so the build needs no extra copy step.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // MapLibre is one large, rarely changing chunk; keep it apart from the app code.
    chunkSizeWarningLimit: 1200,
  },
  test: {
    // The tests are pure logic and read the JSON contract with node:fs.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
