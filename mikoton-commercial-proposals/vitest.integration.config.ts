import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

process.env.TWENTY_TEST_INSTANCE_MODE = 'ephemeral';

export default defineConfig({
  plugins: [
    tsconfigPaths({
      projects: ['tsconfig.spec.json'],
      ignoreConfigErrors: true,
    }),
  ],
  test: {
    testTimeout: 180_000,
    hookTimeout: 180_000,
    fileParallelism: false,
    include: ['src/__tests__/*.integration.test.ts'],
    globalSetup: ['src/__tests__/global-setup.ts'],
  },
});
