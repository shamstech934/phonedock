import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    languageOptions: { globals: { React: "readonly" } },
    rules: {
      // TypeScript owns unused-variable analysis; disabling the base rule avoids duplicate reports.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/prefer-as-const": "off",
      "@typescript-eslint/no-unused-disable-directive": "off",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/purity": "off",
      "react/no-unescaped-entities": "off",
      "react/display-name": "off",
      "react/prop-types": "off",
      "react-compiler/react-compiler": "off",
      "react-hooks/set-state-in-effect": "off",
      "@next/next/no-img-element": "off",
      "@next/next/no-html-link-for-pages": "off",
      "prefer-const": "off",
      "no-console": "off",
      "no-debugger": "off",
      "no-empty": ["warn", { allowEmptyCatch: false }],
      "no-irregular-whitespace": "off",
      "no-case-declarations": "error",
      "no-fallthrough": "error",
      "no-mixed-spaces-and-tabs": "off",
      "no-redeclare": "error",
      "no-undef": "off",
      "no-unreachable": "error",
      "no-useless-escape": "off",
    },
  },
  {
    // Generated shadcn/Radix wrappers and deterministic test fixtures have a separate policy.
    files: ["src/components/ui/**/*.{ts,tsx}", "scripts/__tests__/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-empty": "off",
    },
  },
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills/**", "coverage/**", "playwright-report/**", "test-results/**"],
  },
];

export default eslintConfig;
