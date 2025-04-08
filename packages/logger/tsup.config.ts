// packages/logger/tsup.config.ts (Ensure this file exists with this content)
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,               // <--- Make sure this is true
  splitting: false,
  sourcemap: true,
  clean: true,
  tsconfig: "tsconfig.json", // <--- Point to the correct tsconfig
});