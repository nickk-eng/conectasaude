const modulosPrincipais = [
  "Controller/avaliacaoController.js",
  "Controller/jogoController.js",
  "Controller/privacidadeController.js",
  "Controller/salaController.js",
  "Middleware/avaliacao.js",
  "Service/acessoService.js",
  "Service/avaliacaoService.js",
  "Service/senhaService.js",
];

module.exports = {
  testEnvironment: "node",
  clearMocks: true,
  collectCoverageFrom: modulosPrincipais,
  coverageReporters: ["text", "html", "json-summary"],
  coverageThreshold: Object.fromEntries(
    modulosPrincipais.map((arquivo) => ["./" + arquivo, { lines: 50 }]),
  ),
};
