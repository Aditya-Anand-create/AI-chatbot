import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Dev proxy: the browser calls /api on the Vite port, Vite forwards to Express (no CORS issues).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": "http://localhost:5000" } },
});
