import baseConfig, { restrictEnvAccess } from "@repo/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  { ignores: ["dist/**"] },
  ...baseConfig,
  // Enforce that this package CANNOT directly access process.env
  ...restrictEnvAccess,
]; 