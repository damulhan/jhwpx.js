import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@ssabrojs/hwpxjs": new URL("./src/vendor/hwpxjs.browser.mjs", import.meta.url).pathname,
    },
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
});
