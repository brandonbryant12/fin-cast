import baseConfig, { restrictEnvAccess } from "@repo/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: [
      // "dist/**", // No longer needed as we don't build to dist
      ".turbo/**",
    ],
  },
  ...baseConfig,
  {
    files: ["src/**/*.ts"],
    rules: {
      // Console logs might be acceptable in the CLI, but warn for library code
      // We apply it broadly and override for cli.ts if needed,
      // or rely on the fact the library falls back to console if no logger provided.
      // Let's keep the general warn for now.
      "no-console": "warn",
    },
  },
  // Keep allowing process.env specifically in the CLI's logger config
  {
    files: ["src/config/logger.ts"],
    rules: {
      'no-restricted-properties': 'off',
      'no-restricted-imports': 'off',
    },
  },
   // Allow console.log specifically in the CLI entry point if needed
   {
     files: ["src/cli.ts"],
     rules: {
       "no-console": "off", // Allow console.log for CLI output
     },
   }
]; 