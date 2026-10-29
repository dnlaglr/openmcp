import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    projects: [
      { extends: true, test: { name: "unit", include: ["{apps,packages}/*/tests/unit/**/*.test.ts"] } },
      { extends: true, test: { name: "e2e", include: ["{apps,packages}/*/tests/e2e/**/*.test.ts"] } }
    ]
  }
});
