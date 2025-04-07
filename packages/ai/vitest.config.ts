import baseConfig from "@repo/vitest-config/base"; // Assuming shared config exists
import { defineProject } from "vitest/config";

export default defineProject({
  ...baseConfig,
  test: {
    // AI package specific test settings can go here
    environment: "node", // Explicitly set environment for this package
    globals: true, // Use global APIs (describe, it, expect)
    // setupFiles: ['./src/tests/setup.ts'] // Optional setup file
  },
}); 
 