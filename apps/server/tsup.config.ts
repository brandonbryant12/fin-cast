// apps/server/tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['./src/index.ts'],
  format: 'esm',
  noExternal: [/.*/],
  platform: 'node',
  splitting: false,
  bundle: true,
  outDir: './dist',
  clean: true,
  loader: { '.json': 'copy' },
  minify: false,
  sourcemap: true,

  banner: ({ format }) => {
    if (format === 'esm') {
      return {
        js: `
        // --- Start ESM Shims ---
        import { createRequire } from 'module';

        // Shim require - needed to load 'url' and 'path' modules below
        const require = createRequire(import.meta.url);

        // Shim __filename and __dirname using the shimmed require and native import.meta.url
        // This avoids top-level 'import' in the banner string, which might resolve the conflict.
        let __filename = '';
        let __dirname = '';
        try {
            // Use the shimmed require to get CJS modules
            const url = require('url');
            const path = require('path');
            // Use native ESM import.meta.url to get the current file path
            __filename = url.fileURLToPath(import.meta.url);
            __dirname = path.dirname(__filename);
        } catch (e) {
            console.error('Failed to create __filename/__dirname shims in banner:', e);
            // If fluent-ffmpeg absolutely needs these, this error is critical.
        }
        // --- End ESM Shims ---
        `,
      };
    }
    return {};
  },
});