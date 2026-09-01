import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['engine/**/*.test.ts'],
    benchmark: {
      include: ['engine/**/*.bench.ts'],
    },
  },
});
