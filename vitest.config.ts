import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  test: {
    include: [
      'shared/**/*.test.ts',
      'src/**/*.test.ts',
      'backend/src/**/*.test.ts',
    ],
    environment: 'node',
  },
})
