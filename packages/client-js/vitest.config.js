import { defineConfig } from 'vitest/config';

// No DOM/Vue dependency in this package's specs, so the default node environment is enough —
// unlike apps/studio, which needs jsdom for its component tests.
export default defineConfig({
    test: {
        include: ['**/*.spec.js'],
    },
});
