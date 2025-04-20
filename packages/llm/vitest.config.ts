import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Enable global APIs like `describe`, `it`, `expect`
    globals: true,
    // Add any other specific test configuration here if needed
    // environment: 'node', // Default environment is node
    // setupFiles: ['./test/setup.ts'], // Path to a setup file
  },
});