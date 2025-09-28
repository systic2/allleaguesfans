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
    server: {
      proxy: {
        '/api/thesportsdb': {
          target: 'https://www.thesportsdb.com/api/v2/json',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/thesportsdb/, ''),
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              // Add API key to headers
              const apiKey = process.env.THESPORTSDB_API_KEY || process.env.THESPORTSDB_KEY;
              if (apiKey) {
                proxyReq.setHeader('X-API-KEY', apiKey);
              }
            });
          },
        },
        '/api/highlightly': {
          target: 'https://sports.highlightly.net',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/highlightly/, ''),
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              // Add Highlightly API headers
              const apiKey = process.env.HIGHLIGHTLY_API_KEY || process.env.VITE_HIGHLIGHTLY_API_KEY;
              if (apiKey) {
                proxyReq.setHeader('X-RapidAPI-Key', apiKey);
                proxyReq.setHeader('X-RapidAPI-Host', 'sports.highlightly.net');
              }
            });
          },
        },
      },
    },
  };
});
