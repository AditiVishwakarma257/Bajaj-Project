import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // root is already frontend/, index.html is here
  plugins: [react()],
  server: {
    // in local dev, proxy /tickets calls to netlify dev
    proxy: {
      "/tickets": "http://localhost:8888",
    },
  },
  build: {
    outDir: "dist",
  },
});
