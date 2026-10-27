import { defineConfig, mergeConfig } from "vitest/config";
import base from "@openmcp/vitest-config/base";

export default mergeConfig(
  base,
  defineConfig({
    test: {
      name: "database",
      include: ["tests/**/*.test.ts"],
    }
  })
);
