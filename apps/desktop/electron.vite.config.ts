import { defineConfig } from "electron-vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  main: {
    build: {
      outDir: resolve("dist/main"),
      rolldownOptions: { input: { index: resolve("src/main/index.ts"), bridge: resolve("src/main/bridge.ts") } }
    }
  },
  preload: { build: { outDir: resolve("dist/preload") } },
  renderer: {
    resolve: { alias: { "@": resolve("src/renderer") } },
    plugins: [react(), tailwindcss()],
    build: {
      outDir: resolve("dist/renderer"),
      rolldownOptions: {
        input: {
          index: resolve("src/renderer/index.html"),
          updater: resolve("src/renderer/updater.html")
        }
      }
    }
  }
});
