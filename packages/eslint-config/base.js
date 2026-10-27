import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier/flat";
import tseslint from "typescript-eslint";
import js from "@eslint/js";

export default defineConfig(
  globalIgnores(["out/", "dist/", "drizzle/"]),
  js.configs.recommended,
  tseslint.configs.recommended,
  prettier,
);
