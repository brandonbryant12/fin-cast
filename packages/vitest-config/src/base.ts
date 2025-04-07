/// <reference types="vitest" />
import { defineConfig, type UserConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Define the base configuration
const baseConfig: UserConfig = {
  plugins: [
    // This plugin maps TSConfig paths to Vite aliases
    // allowing imports like `~/components/button`
    tsconfigPaths(),
  ],
  test: {
    // Default test options for all packages
    globals: true, // Use global APIs (describe, it, etc.)
    // environment: 'jsdom', // Uncomment if testing browser-based code
    // setupFiles: [], // Add global setup files if needed
    coverage: {
      // Default coverage options
      provider: "v8",
      reporter: ["text", "json-summary", "json"],
      // Add directories/files to include/exclude from coverage
      // include: ['src/**'],
      // exclude: [],
    },
  },
};

// Export the base configuration
export default defineConfig(baseConfig); 