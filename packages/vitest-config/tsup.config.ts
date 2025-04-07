import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/base.ts"], // Define entry points
  format: ["esm"], // Use esm format
  dts: true, // Generate declaration files (.d.ts)
  splitting: false,
  sourcemap: true,
  clean: true,
}); 