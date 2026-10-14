import { defineConfig } from "vite";

// relative base so the build works from any subpath (e.g. GitHub Pages)
export default defineConfig({
  base: "./",
  server: { port: 5181, strictPort: true },
  build: { chunkSizeWarningLimit: 700 }, // three.js alone is ~500 kB minified
});
