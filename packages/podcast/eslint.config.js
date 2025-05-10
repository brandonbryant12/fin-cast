import baseConfig from "@repo/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: [
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
      "no-console": "warn", 
    },
  }
]; 