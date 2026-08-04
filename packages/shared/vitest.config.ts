import { defineConfig } from 'vitest/config'

// See apps/api/vitest.config.ts — `tsc -b` emits compiled *.test.js into
// dist/, which Vitest would otherwise run alongside the sources.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
})
