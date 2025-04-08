import baseConfig, { restrictEnvAccess } from "@repo/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: [
      "dist/**",
      ".turbo/**",
    ],
  },
  ...baseConfig,
  {
    files: ["src/**/*.ts"],
    rules: {
      "no-console": "warn",
    },
  },
  {
    files: ["src/config/logger.ts"],
    rules: {
      ...restrictEnvAccess.rules,
      "@typescript-eslint/no-restricted-imports": "off",
    },
  },
]; 