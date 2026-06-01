import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(__dirname),
  plugins: [react()],
  server: {
    port: 5180,
    proxy: {
      "/api": "http://localhost:4180",
      "/api/pty": { target: "ws://localhost:4180", ws: true },
    },
  },
  build: {
    outDir: resolve(__dirname, "../../dist/web"),
    emptyOutDir: true,
  },
});
