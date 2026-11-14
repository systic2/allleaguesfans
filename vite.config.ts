import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react-swc";
import { visualizer } from "rollup-plugin-visualizer";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const plugins: PluginOption[] = [react()];

  if (process.env.ANALYZE) {
    plugins.push(
      visualizer({
        filename: "dist/stats.html",
        gzipSize: true,
        brotliSize: true,
        open: true,
      }) as unknown as PluginOption
    );
  }

  return {
    plugins,
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    build: {
      sourcemap: mode !== "production",
    },
  };
});
