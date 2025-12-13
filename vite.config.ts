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
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
        },
        '/api/highlightly': {
          target: 'https://sports.highlightly.net',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/highlightly/, ''),
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req, _res) => {
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
