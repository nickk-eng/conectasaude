const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { createContext, runInContext } = require("node:vm");

test("atualiza a fila do administrador ao voltar para a aba e enquanto ela está visível", async () => {
  const eventos = {};
  const elementos = new Map();
  const pergunta = { id: 1, status: "pendente" };
  const busca = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ perguntas: [] }) })
    .mockResolvedValue({ ok: true, json: async () => ({ perguntas: [pergunta] }) });
  let liberarSessao;
  const sessao = new Promise((resolve) => { liberarSessao = resolve; });
  const document = {
    hidden: false,
    querySelector(seletor) {
      if (!elementos.has(seletor)) elementos.set(seletor, { addEventListener: jest.fn() });
      return elementos.get(seletor);
    },
    addEventListener: (evento, callback) => { eventos[evento] = callback; },
  };
  const contexto = createContext({
    document,
    configurarNavegacaoFerramentas: jest.fn(),
    verificarSessaoPagina: () => sessao,
    apiFetch: busca,
    window: {
      addEventListener: (evento, callback) => { eventos[evento] = callback; },
      setInterval: (callback, intervalo) => {
        expect(intervalo).toBe(10000);
        eventos.intervalo = callback;
      },
    },
  });
  runInContext(readFileSync(join(__dirname, "../View/js/admin.js"), "utf8"), contexto);
  for (const nome of [
    "carregarUsuarios", "carregarResumoAdmin", "carregarAuditoria",
    "carregarSolicitacoesPrivacidade", "atualizarResumoPerguntas", "renderizarPerguntas",
  ]) contexto[nome] = jest.fn();

  const concluirRequisicao = () => new Promise((resolve) => setImmediate(resolve));
  liberarSessao({ usuario: { id: "admin-teste" } });
  await concluirRequisicao();
  expect(contexto.atualizarResumoPerguntas).toHaveBeenLastCalledWith([]);

  document.hidden = true;
  eventos.intervalo();
  expect(busca).toHaveBeenCalledTimes(1);

  document.hidden = false;
  eventos.visibilitychange();
  await concluirRequisicao();
  expect(contexto.atualizarResumoPerguntas).toHaveBeenLastCalledWith([pergunta]);
  expect(contexto.renderizarPerguntas).toHaveBeenCalledTimes(2);

  eventos.intervalo();
  await concluirRequisicao();
  expect(busca).toHaveBeenCalledTimes(3);
  expect(contexto.renderizarPerguntas).toHaveBeenCalledTimes(2);
});
