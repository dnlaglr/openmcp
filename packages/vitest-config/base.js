import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    passWithNoTests: true,
    projects: [
      { extends: true, test: { name: "unit", include: ["tests/unit/**/*.test.ts"] } },
      { extends: true, test: { name: "e2e", include: ["tests/e2e/**/*.test.ts"] } }
    ]
  }
});
