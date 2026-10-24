import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server proxies /api -> local backend so the frontend uses a single
// same-origin base path in every environment (see src/api.ts).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
