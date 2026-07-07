// Minimal flat config (KW-009): lint the Node/JS sources only. The .ts client
// modules are type-checked/bundled by esbuild, so eslint ignores them here to
// stay dependency-light (no TS parser). Recommended rules, a few relaxed for the
// build-script style already in the repo.
import js from "@eslint/js";

export default [
  { ignores: ["dist/**", "node_modules/**", "**/*.ts"] },
  js.configs.recommended,
  {
    files: ["**/*.mjs", "**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        process: "readonly", console: "readonly", URL: "readonly", Buffer: "readonly",
        setTimeout: "readonly", TextEncoder: "readonly", fetch: "readonly",
        structuredClone: "readonly", globalThis: "readonly", performance: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
];
