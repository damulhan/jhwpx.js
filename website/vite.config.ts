import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@ssabrojs/hwpxjs": new URL("../packages/hwpxjs/dist/browser/hwpxjs.browser.mjs", import.meta.url).pathname,
    },
  },
  server: {
    port: 3000,
  },
});
