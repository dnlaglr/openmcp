import { defineConfig, globalIgnores } from "eslint/config";
import perfectionist from "eslint-plugin-perfectionist";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier/flat";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import js from "@eslint/js";

export default defineConfig(
  globalIgnores([
    "**/dist/",
    "**/out/",
    "packages/database/migrations/",
    // CLI generated shadcn/ui components
    "apps/desktop/src/renderer/components/ui",
    "apps/desktop/src/renderer/hooks/use-mobile.ts"
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["apps/desktop/src/renderer/**/*.tsx"],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite]
  },
  {
    plugins: { perfectionist },
    rules: {
      "perfectionist/sort-imports": [
        "error",
        {
          type: "line-length",
          order: "desc",
          internalPattern: ["^@/"],
          customGroups: [{ groupName: "openmcp", elementNamePattern: "^@openmcp/" }],
          groups: [
            ["external", "builtin"],
            "openmcp",
            ["internal", "parent", "sibling", "index"],
            ["side-effect", "side-effect-style"],
            "unknown"
          ],
          newlinesBetween: 1
        }
      ]
    }
  },
  prettier
);
