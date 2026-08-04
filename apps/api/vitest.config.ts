import { defineConfig } from 'vitest/config'

// `tsc -b` emits the compiled *.test.js next to the sources in dist/, which
// Vitest's default include would otherwise pick up — running every suite
// twice, against stale output, once anything has been built locally.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
})
