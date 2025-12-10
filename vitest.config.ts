import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: "src/tests/setup.ts",
    exclude: ['tests/integration/**'],
    include: ['src/tests/**/*.test.{ts,tsx}']
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
