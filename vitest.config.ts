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
      'scripts/**/*.test.mjs',
      'backend/scripts/**/*.test.mjs',
    ],
    environment: 'node',
    // Vitest 4 no longer reads this key. src/**/*.test.ts also declares
    // @vitest-environment happy-dom, which is what Vitest 4 applies.
    environmentMatchGlobs: [['src/**/*.test.ts', 'happy-dom']],
  },
})
