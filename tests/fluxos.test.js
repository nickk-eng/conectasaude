jest.mock("../Model/perguntaModel", () => ({ sortearAprovadas: jest.fn() }));
jest.mock("../Model/partidaModel", () => ({ registrar: jest.fn() }));
jest.mock("../Model/privacidadeModel", () => ({
  criar: jest.fn(), listarDoUsuario: jest.fn(), responder: jest.fn(),
}));
jest.mock("../Service/auditoriaService", () => ({ registrarAuditoria: jest.fn() }));
jest.mock("../Service/salasAtivas", () => ({
  criar: jest.fn(), entrar: jest.fn(), consultar: jest.fn(), agir: jest.fn(),
  removerDoUsuario: jest.fn(),
}));
jest.mock("../Service/avaliacaoService", () => ({
  ErroRegra: class ErroRegra extends Error {
    constructor() {
      super("Regra da avaliação.");
      this.status = 403;
      this.codigo = "PRE_TESTE_PENDENTE";
    }
  },
  status: jest.fn(), iniciar: jest.fn(), responder: jest.fn(), preTesteConcluido: jest.fn(),
}));

const jogo = require("../Controller/jogoController");
const avaliacao = require("../Controller/avaliacaoController");
const privacidade = require("../Controller/privacidadeController");
const sala = require("../Controller/salaController");
const { exigirPreTeste } = require("../Middleware/avaliacao");
const perguntas = require("../Model/perguntaModel");
const partidas = require("../Model/partidaModel");
const pedidos = require("../Model/privacidadeModel");
const avaliacoes = require("../Service/avaliacaoService");
const salas = require("../Service/salasAtivas");

const usuario = { id: "aluno-teste" };

function resposta() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn(), end: jest.fn() };
}

test("lista perguntas com alternativas armazenadas em JSON ou em lista", async () => {
  perguntas.sortearAprovadas.mockResolvedValue([
    { texto: "A?", alternativas: '["A", "B"]', resposta_correta: 0 },
    { texto: "B?", alternativas: ["C", "D"], resposta_correta: 1 },
  ]);
  const res = resposta();
  await jogo.listarPerguntas({ query: { nivel: "Fácil", categoriaIst: "hpv" } }, res);
  expect(perguntas.sortearAprovadas).toHaveBeenCalledWith("Fácil", "hpv");
  expect(res.json).toHaveBeenCalledWith({ perguntas: [
    { texto: "A?", opcoes: ["A", "B"], certa: 0 },
    { texto: "B?", opcoes: ["C", "D"], certa: 1 },
  ] });
});

test("normaliza o resultado da partida antes de persistir", async () => {
  const res = resposta();
  await jogo.registrarResultado({ usuario, body: { acertos: "3000", erros: -4 } }, res);
  expect(partidas.registrar).toHaveBeenCalledWith({
    usuarioId: usuario.id, acertos: 1000, erros: 0, nivel: "Fácil",
    modo: "computador", resultado: "",
  });
  expect(res.status).toHaveBeenCalledWith(204);
  expect(res.end).toHaveBeenCalled();
});

test("rejeita um tipo de avaliação inexistente e traduz erros de negócio", async () => {
  const invalida = resposta();
  await avaliacao.iniciar({ usuario, params: { tipo: "invalido" } }, invalida);
  expect(invalida.status).toHaveBeenCalledWith(404);
  expect(avaliacoes.iniciar).not.toHaveBeenCalled();

  const bloqueada = resposta();
  avaliacoes.iniciar.mockRejectedValueOnce(new avaliacoes.ErroRegra());
  await avaliacao.iniciar({ usuario, params: { tipo: "pos" } }, bloqueada);
  expect(bloqueada.status).toHaveBeenCalledWith(403);
  expect(bloqueada.json).toHaveBeenCalledWith(expect.objectContaining({ codigo: "PRE_TESTE_PENDENTE" }));
});

test("encaminha status, início e respostas de uma avaliação", async () => {
  const res = resposta();
  const req = { usuario, params: { tipo: "pre" }, body: { respostas: [] } };
  avaliacoes.status.mockResolvedValue({ proximaEtapa: "pre" });
  avaliacoes.iniciar.mockResolvedValue({ criada: true, total: 5 });
  avaliacoes.responder.mockResolvedValue({ acertos: 2, total: 5 });
  await avaliacao.status(req, res);
  await avaliacao.iniciar(req, res);
  await avaliacao.responder(req, res);
  expect(res.json.mock.calls).toEqual([
    [{ proximaEtapa: "pre" }], [{ criada: true, total: 5 }], [{ acertos: 2, total: 5 }],
  ]);
});

test("exige avaliação diagnóstica antes de jogar", async () => {
  const res = resposta();
  const next = jest.fn();
  avaliacoes.preTesteConcluido.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  await exigirPreTeste({ usuario }, res, next);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
  await exigirPreTeste({ usuario }, res, next);
  expect(next).toHaveBeenCalledTimes(1);
});

test("valida o tipo, registra o pedido e lista pedidos do titular", async () => {
  const invalida = resposta();
  await privacidade.criarSolicitacao({ usuario, body: { tipo: "invalido" } }, invalida);
  expect(invalida.status).toHaveBeenCalledWith(400);
  expect(pedidos.criar).not.toHaveBeenCalled();

  const criada = resposta();
  pedidos.criar.mockResolvedValue(7);
  await privacidade.criarSolicitacao({ usuario, body: { tipo: "acesso", mensagem: "  Meu pedido  " } }, criada);
  expect(pedidos.criar).toHaveBeenCalledWith({ usuarioId: usuario.id, tipo: "acesso", mensagem: "Meu pedido" });
  expect(criada.status).toHaveBeenCalledWith(201);
  pedidos.listarDoUsuario.mockResolvedValue([{ id: 7 }]);
  await privacidade.minhasSolicitacoes({ usuario }, criada);
  expect(criada.json).toHaveBeenLastCalledWith({ solicitacoes: [{ id: 7 }] });
});

test("exige comprovação e confirmação para concluir uma solicitação", async () => {
  const res = resposta();
  const req = { usuario, params: { id: "7" }, body: { status: "concluida", resposta: "Resposta de teste" } };
  await privacidade.responderSolicitacao(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(pedidos.responder).not.toHaveBeenCalled();
  Object.assign(req.body, {
    providencia: "Dados disponibilizados ao titular.",
    comprovante: "TESTE-007",
    confirmouAtendimento: true,
  });
  pedidos.responder.mockResolvedValue({ id: 7 });
  await privacidade.responderSolicitacao(req, res);
  expect(pedidos.responder).toHaveBeenCalledWith("7", "concluida", req.body.resposta, usuario.id, {
    providencia: req.body.providencia, comprovante: "TESTE-007", confirmarEliminacao: false,
  });
  expect(res.json).toHaveBeenLastCalledWith({ mensagem: "Resposta e status atualizados." });
  expect(salas.removerDoUsuario).not.toHaveBeenCalled();
});

test("retorna 201 ao criar sala e preserva o status de um erro de negócio", async () => {
  const res = resposta();
  salas.criar.mockResolvedValue({ codigo: "1234" });
  salas.entrar.mockRejectedValue(Object.assign(new Error("Sala indisponível."), { status: 409 }));
  await sala.criar({ usuario, body: { nivel: "Fácil", codigo: "1234" } }, res);
  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith({ codigo: "1234" });
  await sala.entrar({ usuario, body: { codigo: "1234" } }, res);
  expect(res.status).toHaveBeenLastCalledWith(409);
  expect(res.json).toHaveBeenLastCalledWith({ mensagem: "Sala indisponível." });
});

test("encaminha a consulta e a jogada para a sala correta", async () => {
  const res = resposta();
  const req = { usuario, params: { codigo: "1234" }, query: { partida: "p1" }, body: { acao: "iniciar" } };
  await sala.consultar(req, res);
  await sala.agir(req, res);
  expect(salas.consultar).toHaveBeenCalledWith(usuario, "1234", "p1");
  expect(salas.agir).toHaveBeenCalledWith(usuario, "1234", req.body);
});
