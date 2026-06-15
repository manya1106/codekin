import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  plugins: [react(), viteStaticCopy({ targets: [{ src: "manifest.json", dest: "." }] })],
  build: {
    outDir: "dist", emptyOutDir: true,
    rollupOptions: {
      input: { popup: resolve(fileURLToPath(new URL(".", import.meta.url)), "popup.html"), background: resolve(fileURLToPath(new URL(".", import.meta.url)), "src/background.ts"), content: resolve(fileURLToPath(new URL(".", import.meta.url)), "src/content.ts") },
      output: { entryFileNames: "assets/[name].js", chunkFileNames: "assets/[name]-[hash].js", assetFileNames: "assets/[name]-[hash][extname]" },
    },
  },
});
