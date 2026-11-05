import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  base: "./", // ✅ Important for Electron to find assets
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
