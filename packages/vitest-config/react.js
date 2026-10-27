import { defineConfig, mergeConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import base from "./base.js";

export default mergeConfig(
  base,
  defineConfig({
    test: {
      environment: "jsdom",
      setupFiles: [fileURLToPath(new URL("./react-setup.js", import.meta.url))],
    },
  }),
);
