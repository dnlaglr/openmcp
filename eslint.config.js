import js from "@eslint/js";
import prettier from "eslint-config-prettier/flat";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores([
    "**/dist/",
    "**/out/",
    "packages/database/migrations/",
    // CLI generated shadcn/ui components
    "apps/desktop/src/renderer/src/components/ui",
    "apps/desktop/src/renderer/src/hooks/use-mobile.ts"
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["apps/desktop/src/renderer/**/*.tsx"],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite]
  },
  prettier
);
