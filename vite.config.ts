import { defineConfig } from "vitest/config"; // ⬅️ 요게 핵심
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/tests/setupTests.ts"],
    // globals: true, // (선택) describe/it/expect를 전역으로 쓰고 싶으면
    css: true,
  },
});
