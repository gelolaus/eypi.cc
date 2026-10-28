import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss(), cloudflare()],
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        // Vue SFC helper chunks get a very long generated name that the entry repeats in its preload map.
        chunkFileNames: (chunk) => `assets/${chunk.name.replace('.vue_vue_type_script_setup_true_lang', '')}-[hash:7].js`,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
})