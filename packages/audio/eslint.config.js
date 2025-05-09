import baseConfig, { restrictEnvAccess } from "@repo/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...baseConfig,
  ...restrictEnvAccess,
  {
    ignores: ['dist/**'],
  },
];