import baseConfig from "@repo/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  { ignores: ["dist/**"] }, // Keep ignoring potential leftover build artifacts
  ...baseConfig,
  // No longer need restrictEnvAccess here as the package won't access process.env
]; 