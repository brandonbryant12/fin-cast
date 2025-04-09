import baseConfig from "@repo/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: [
      // Ignore build artifacts and caches
      "dist/**", 
      ".turbo/**",
      ".cache/**", 
      "node_modules/**"
    ],
  },
  ...baseConfig,
  {
    files: ["src/**/*.ts"],
    rules: {
      // Example: Warn about console logs in library code
      "no-console": "warn", 
    },
  }
  // Removed overrides specific to webscraper (cli.ts, config/logger.ts)
]; 