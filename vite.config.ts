import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import handler from "./api/search";
export default defineConfig({
  define: {
    global: "globalThis",
    "process.env": {},
    "process.platform": JSON.stringify("browser"),
  },
  plugins: [
    react(),
    {
      name: "scientific-api",
      configureServer(server) {
        server.middlewares.use("/api/search", (req, res) => {
          const query = Object.fromEntries(
            new URL(req.url ?? "", "http://localhost").searchParams,
          );
          const response = {
            status(n: number) {
              res.statusCode = n;
              return response;
            },
            json(value: unknown) {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(value));
            },
            setHeader(k: string, v: string) {
              res.setHeader(k, v);
            },
          };
          void handler({ method: req.method, query }, response);
        });
      },
    },
  ],
  build: {
    // Ketcher core mixes ESM exports with a Raphael require; transform both.
    commonjsOptions: { transformMixedEsModules: true },
    rollupOptions: { input: { main: "index.html", editor: "editor.html" } },
  },
  optimizeDeps: { exclude: ["@rdkit/rdkit"] },
});
