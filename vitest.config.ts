import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      shared: path.resolve(__dirname, "./shared/src/index.ts"),
    },
  },
  test: {
    include: ["shared/src/**/*.test.ts", "server/src/**/*.test.ts"],
  },
});
