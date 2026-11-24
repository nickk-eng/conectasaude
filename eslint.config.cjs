const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  { ignores: ["coverage/**"] },
  js.configs.recommended,
  {
    languageOptions: { sourceType: "commonjs", globals: globals.node },
    rules: {
      "no-unused-vars": ["warn", { vars: "local", args: "none", caughtErrors: "none" }],
    },
  },
  {
    files: ["View/js/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        ...globals.browser,
        apiFetch: "readonly",
        verificarSessaoPagina: "readonly",
        salvarToken: "readonly",
        removerToken: "readonly",
        configurarNavegacaoFerramentas: "readonly",
        paginarTabela: "readonly",
      },
    },
  },
  {
    files: ["View/js/auth.js"],
    languageOptions: { globals: { apiFetch: "off", verificarSessaoPagina: "off", salvarToken: "off", removerToken: "off" } },
  },
  { files: ["View/js/sala.js"], languageOptions: { globals: { CHAVE_SESSAO: "readonly" } } },
  {
    files: ["View/js/navegacaoFerramentas.js"],
    languageOptions: { globals: { configurarNavegacaoFerramentas: "off" } },
  },
  {
    files: ["View/js/paginarTabela.js"],
    languageOptions: { globals: { paginarTabela: "off" } },
  },
  { files: ["tests/**/*.test.js"], languageOptions: { globals: globals.jest } },
];
