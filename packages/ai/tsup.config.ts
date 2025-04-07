import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/prompts/index.ts"],
  format: ["esm"], // Use esm format
  dts: false, // Disable tsup's DTS generation, tsc will handle it
  splitting: false,
  sourcemap: true, // Keep JS sourcemaps from tsup
  clean: true, // Clean dist before tsup runs
  // No external needed for internal package libraries
}); 