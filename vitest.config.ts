import { defineConfig } from 'vitest/config';

/**
 * Root Vitest config: each package also runs its own suite (`pnpm --filter <pkg> test`), this one
 * is what `pnpm vitest run` from the repo root uses. Tests live beside the code they cover, as
 * `*.test.ts` files inside each package's `src/` directory (see docs/tasks/).
 */
export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'packages/*/src/**/*.test.tsx', 'apps/*/src/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
});
