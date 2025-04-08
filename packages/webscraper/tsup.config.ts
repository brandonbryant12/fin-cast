import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm'],
  sourcemap: true,
  clean: true,
  splitting: false,
  dts: {
    entry: {
      index: 'src/index.ts',
      cli: 'src/cli.ts'
    },
    compilerOptions: {
      composite: false,
      incremental: false
    }
  }
});