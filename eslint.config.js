import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "jsx-a11y": jsxA11y,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Acessibilidade: pega rotulo ausente, alt faltando e afins na hora de escrever,
      // em vez de numa auditoria meses depois.
      ...jsxA11y.flatConfigs.recommended.rules,
      // Fora do conjunto recomendado por ser barulhenta, mas é justamente a que pega
      // campo de formulário sem nome acessível — a falha mais comum aqui.
      // Fora do conjunto recomendado, mas é a única que pega campo de formulário sem
      // nome acessível — a falha mais comum aqui. `td` entra na lista de ignorados
      // porque célula de tabela não é controle: sem isso a regra acusa toda `<td>`
      // que contenha uma `<div>` de layout.
      "jsx-a11y/control-has-associated-label": ["error", { ignoreElements: ["td"] }],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // Primitivas do shadcn: repassam `children` por `{...props}`, e as duas regras
    // abaixo não conseguem enxergar isso — acusam conteúdo vazio no componente base
    // mesmo quando todo uso real passa conteúdo. Exceção restrita a esta pasta.
    files: ["src/components/ui/**"],
    rules: {
      "jsx-a11y/heading-has-content": "off",
      "jsx-a11y/anchor-has-content": "off",
    },
  },
  eslintPluginPrettier,
);
