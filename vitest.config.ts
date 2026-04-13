import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/fixtures/calibration/**', 'tests/semantic/fixtures/**', 'node_modules/**'],
    globals: false,
  },
});
