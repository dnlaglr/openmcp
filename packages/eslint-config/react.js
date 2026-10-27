import reactRefresh from "eslint-plugin-react-refresh";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";
import base from "./base.js";

export default defineConfig(base, {
  files: ["**/*.tsx"],
  extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
});
