import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node, // Added: Allows 'process', '__dirname', etc.
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "no-undef": "error",
      "react/react-in-jsx-scope": "off", // React 17+ automatic JSX transform
      "react/prop-types": "off", // TS handles this better
    },
  },
  {
    // Specific ignore rules to keep Bun/Vite fast
    ignores: ["dist/", "node_modules/", ".common/", "tmp/", "src/components/GitPanel.legacy.jsx"],
  }
);