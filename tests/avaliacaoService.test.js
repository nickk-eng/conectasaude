jest.mock("../Model/avaliacaoModel", () => ({
  buscar: jest.fn(), criar: jest.fn(), concluir: jest.fn(),
}));
jest.mock("../Model/partidaModel", () => ({ contarDepoisDoPreTeste: jest.fn() }));
jest.mock("../Model/perguntaModel", () => ({
  buscarPorIds: jest.fn(),
  sortearIdsAprovadas: jest.fn(),
  alternativasDe: (pergunta) => pergunta.alternativas,
}));

const avaliacao = require("../Service/avaliacaoService");
const model = require("../Model/avaliacaoModel");
const partidas = require("../Model/partidaModel");
const perguntas = require("../Model/perguntaModel");

const pergunta = { id: 1, texto: "Pergunta de teste?", alternativas: ["A", "B"], resposta_correta: 1 };
const registro = { id: 10, perguntas: [1] };
const concluida = { ...registro, concluida_em: "2026-01-01", acertos: 0, total: 1 };

beforeEach(() => {
  model.buscar.mockReset();
  model.criar.mockReset();
  model.concluir.mockReset();
  partidas.contarDepoisDoPreTeste.mockReset();
  perguntas.buscarPorIds.mockResolvedValue([pergunta]);
  perguntas.sortearIdsAprovadas.mockResolvedValue([1]);
});

test("bloqueia o pós-teste enquanto o pré-teste estiver pendente", async () => {
  model.buscar.mockResolvedValue(null);
  await expect(avaliacao.preTesteConcluido(1)).resolves.toBe(false);
  await expect(avaliacao.status(1)).resolves.toMatchObject({ proximaEtapa: "pre", posLiberado: false });
  await expect(avaliacao.iniciar(1, "pos")).rejects.toMatchObject({ codigo: "PRE_TESTE_PENDENTE" });
});

test("libera o pós-teste somente depois de uma partida", async () => {
  model.buscar.mockImplementation(async (_id, tipo) => tipo === "pre" ? concluida : null);
  partidas.contarDepoisDoPreTeste.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
  await expect(avaliacao.iniciar(1, "pos")).rejects.toMatchObject({ codigo: "JOGUE_ANTES" });
  await expect(avaliacao.status(1)).resolves.toMatchObject({ proximaEtapa: "pos", posLiberado: true });
});

test("cria o pré-teste sem apresentar o gabarito", async () => {
  model.criar.mockResolvedValue({ avaliacao: registro, criada: true });
  await expect(avaliacao.iniciar(1, "pre")).resolves.toEqual({
    concluida: false, criada: true, tipo: "pre", total: 1,
    perguntas: [{ id: "1", texto: pergunta.texto, opcoes: ["A", "B"] }],
  });
  expect(model.criar).toHaveBeenCalledWith({ usuarioId: 1, tipo: "pre", perguntas: [1] });
});

test("rejeita respostas incompletas e registra a pontuação válida", async () => {
  model.buscar.mockResolvedValue(registro);
  model.concluir.mockResolvedValue(true);
  await expect(avaliacao.responder(1, "pre", [])).rejects.toMatchObject({ codigo: "RESPOSTAS_INCOMPLETAS" });
  expect(model.concluir).not.toHaveBeenCalled();
  await expect(avaliacao.responder(1, "pre", [{ perguntaId: 1, resposta: 1 }]))
    .resolves.toEqual({ tipo: "pre", acertos: 1, total: 1, percentual: 100 });
  expect(model.concluir).toHaveBeenCalledWith(10, { 1: 1 }, 1);
});

test("calcula as médias somente a partir das avaliações concluídas", () => {
  expect(avaliacao.resumirTurma([
    { id: 1, pre_acertos: 1, pre_total: 2, pos_acertos: 2, pos_total: 2 },
    { id: 2 },
  ])).toMatchObject({ mediaPre: 50, mediaPos: 100, ganhoMedio: 50 });
});
