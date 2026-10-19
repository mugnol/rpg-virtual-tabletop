import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Dev runs same-origin: the Vite dev server proxies API calls to Express,
    // so cookies/auth behave exactly like in production.
    proxy: {
      "/api": "http://localhost:3001",
      "/ws": {
        target: "http://localhost:3001",
        ws: true,
      },
    },
  },
});
