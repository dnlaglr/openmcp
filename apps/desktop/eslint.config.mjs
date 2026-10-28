import { defineConfig } from "eslint/config";

import react from "@openmcp/eslint-config/react";

export default defineConfig(react, {
  files: ["src/renderer/src/components/ui/**"],
  rules: { "react-refresh/only-export-components": "off" }
});
