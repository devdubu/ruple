import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    include: ['apps/**/*.test.ts', 'apps/**/*.test.tsx', 'packages/**/*.test.ts', 'packages/**/*.test.tsx'],
    maxWorkers: 2,
    testTimeout: 10000,
  },
});
