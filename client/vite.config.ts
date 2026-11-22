import { defineConfig } from "vite";
import path from "path";

export default defineConfig(({ command }) => ({
  resolve: {
    alias: {
      shared: path.resolve(__dirname, "../shared/src/index.ts"),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
  // Strip console.log/warn/info from production bundle; keep console.error
  esbuild:
    command === "build"
      ? { pure: ["console.log", "console.info", "console.warn"], drop: ["debugger"] }
      : {},
  build: {
    sourcemap: false,
  },
}));
