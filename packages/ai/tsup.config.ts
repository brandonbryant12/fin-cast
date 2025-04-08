import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/prompts/index.ts"],
  format: ["esm"], // Use esm format
  dts: false, // Keep DTS generation with tsc separately for more control
  splitting: false,
  sourcemap: true, // Keep JS sourcemaps from tsup
  clean: true, // Clean dist before tsup runs
  // Explicitly mark files from dependencies as external
  external: [
    "@ai-sdk/openai",
    "ai",
    "valibot"
  ]
}); 