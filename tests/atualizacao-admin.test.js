const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { createContext, runInContext } = require("node:vm");

test("atualiza a fila do administrador ao voltar para a aba e enquanto ela está visível", async () => {
  const eventos = {};
  const elementos = new Map();
  const pergunta = {
    id: 1,
    texto: "Pergunta da fila de aprovação",
    alternativas: ["Primeira", "Segunda", "Terceira"],
    resposta_correta: 1,
    status: "pendente",
  };
  const cadastrada = { ...pergunta, id: 2, texto: "Pergunta já aprovada", status: "aprovada" };
  let perguntas = [pergunta, cadastrada];
  const busca = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ perguntas: [] }) })
    .mockImplementation(async () => ({ ok: true, json: async () => ({ perguntas }) }));
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
    "carregarSolicitacoesPrivacidade", "atualizarResumoPerguntas", "controlesPaginas",
  ]) contexto[nome] = jest.fn();
  contexto.escapar = (texto) => String(texto ?? "");
  const renderizar = jest.spyOn(contexto, "renderizarPerguntas");

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
  expect(contexto.atualizarResumoPerguntas).toHaveBeenLastCalledWith(perguntas);
  expect(renderizar).toHaveBeenCalledTimes(2);
  const fila = elementos.get("#lista-pendentes");
  const banco = elementos.get("#lista-perguntas");
  expect(fila.innerHTML).toContain(pergunta.texto);
  expect(fila.innerHTML).toContain('data-status="aprovada"');
  expect(fila.innerHTML).not.toContain(cadastrada.texto);
  expect(banco.innerHTML).toContain(cadastrada.texto);
  expect(banco.innerHTML).not.toContain(pergunta.texto);

  eventos.intervalo();
  await concluirRequisicao();
  expect(busca).toHaveBeenCalledTimes(3);
  expect(renderizar).toHaveBeenCalledTimes(2);
  expect(busca.mock.calls).toEqual(
    Array.from({ length: 3 }, () => ["/api/admin/perguntas/sincronizacao"]),
  );

  elementos.get("#atualizar-auditoria").addEventListener.mock.calls[0][1]();
  expect(contexto.carregarAuditoria).toHaveBeenCalledTimes(2);
  expect(busca).toHaveBeenCalledTimes(3);

  const abrirPerguntas = elementos.get('[data-painel-target="painel-admin-perguntas"]');
  abrirPerguntas.getAttribute = () => "true";
  abrirPerguntas.addEventListener.mock.calls[0][1]();
  elementos.get("#atualizar-perguntas").addEventListener.mock.calls[0][1]();
  await concluirRequisicao();
  expect(busca.mock.calls.slice(3)).toEqual([
    ["/api/admin/perguntas"],
    ["/api/admin/perguntas"],
  ]);

  busca.mockImplementationOnce(async () => {
    perguntas = [{ ...pergunta, status: "aprovada" }, cadastrada];
    return { ok: true, json: async () => ({ mensagem: "Pergunta aprovada." }) };
  });
  const aprovar = { dataset: { id: "1", status: "aprovada" } };
  await fila.addEventListener.mock.calls[0][1]({
    target: { closest: () => aprovar },
  });
  await concluirRequisicao();
  expect(busca).toHaveBeenCalledWith("/api/admin/perguntas/1", expect.objectContaining({
    method: "PATCH",
    body: JSON.stringify({ status: "aprovada" }),
  }));
  expect(fila.innerHTML).toBe("");
  expect(elementos.get("#sem-pendentes").hidden).toBe(false);
  expect(banco.innerHTML).toContain(pergunta.texto);
  expect(banco.innerHTML).toContain('data-editar="1"');
});
