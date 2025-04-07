import baseConfig, { restrictEnvAccess } from "@repo/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  { ignores: ["dist/**"] }, // Ignore the output directory
  ...baseConfig,
  // !! IMPORTANT !!
  // This rule prevents direct access to process.env within this package.
  // All environment variables must be passed in via configuration.
  ...restrictEnvAccess,
]; 