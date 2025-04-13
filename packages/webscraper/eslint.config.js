import baseConfig from "@repo/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: [
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
      'no-restricted-properties': 'off',
      'no-restricted-imports': 'off',
    },
  },
   {
     files: ["src/cli.ts"],
     rules: {
       "no-console": "off",
     },
   }
]; 