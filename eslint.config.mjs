import js from "@eslint/js";
import tseslint from "typescript-eslint";
import next from "eslint-config-next";

export default tseslint.config(
  { ignores: [".next/**", "node_modules/**", "out/**", "next-env.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // eslint-config-next's main export is already a flat config array, carrying
  // the next, react and react-hooks plugins plus core-web-vitals rules.
  ...next,
);
