const { once } = require("node:events");
const { readFileSync } = require("node:fs");
const { createServer } = require("node:http");
const { join } = require("node:path");
const { createContext, runInContext } = require("node:vm");
const { WebSocket } = require("ws");

jest.mock("../Middleware/autenticacao", () => ({ buscarUsuarioDaSessao: jest.fn() }));
jest.mock("../Service/avaliacaoService", () => ({ preTesteConcluido: jest.fn() }));
jest.mock("../Service/salasAtivas", () => {
  const { criarServicoSalas } = require("../Service/salaService");
  return criarServicoSalas({
    perguntasModel: {
      sortearAprovadas: async () => [{ texto: "Pergunta", alternativas: ["A", "B", "C"], resposta_correta: 0 }],
    },
    salvarResultados: async () => {},
  });
});

const { buscarUsuarioDaSessao } = require("../Middleware/autenticacao");
const { preTesteConcluido } = require("../Service/avaliacaoService");
const salas = require("../Service/salasAtivas");
const { conectarSalasWebSocket } = require("../Service/salaWebSocket");

test("notifica o adversário ao mudar o turno e rejeita quem não pertence à sala", async () => {
  const alunos = new Map(["x", "o", "visitante"].map((id) => [id, { id, perfil: "aluno" }]));
  buscarUsuarioDaSessao.mockImplementation(async (token) => alunos.get(token));
  preTesteConcluido.mockResolvedValue(true);
  const sala = await salas.criar(alunos.get("x"), "Fácil", "123", null);
  salas.entrar(alunos.get("o"), sala.codigo);
  const servidor = createServer();
  conectarSalasWebSocket(servidor);
  servidor.listen(0, "127.0.0.1");
  await once(servidor, "listening");
  const URL = `ws://127.0.0.1:${servidor.address().port}/api/salas/tempo-real`;
  const clientes = [];
  async function conectar(token) {
    const cliente = new WebSocket(URL);
    clientes.push(cliente);
    await once(cliente, "open");
    cliente.send(JSON.stringify({ token, codigo: sala.codigo, partida: sala.id }));
    return cliente;
  }
  try {
    const visitante = await conectar("visitante");
    expect((await once(visitante, "close"))[0]).toBe(1008);
    const adversario = await conectar("o");
    expect((await once(adversario, "message"))[0].toString()).toBe("atualizar");

    const avisoInicio = once(adversario, "message");
    const iniciado = await salas.agir(alunos.get("x"), sala.codigo, { partida: sala.id, acao: "iniciar" });
    await avisoInicio;
    const avisoResposta = once(adversario, "message");
    const resposta = await salas.agir(alunos.get("x"), sala.codigo, {
      partida: sala.id, acao: "responder", versao: iniciado.versao, resposta: 0,
    });
    await avisoResposta;
    const aviso = once(adversario, "message");
    await salas.agir(alunos.get("x"), sala.codigo, {
      partida: sala.id, acao: "jogar", versao: resposta.versao, casa: 4,
    });
    expect((await aviso)[0].toString()).toBe("atualizar");
    const atualizada = await salas.consultar(alunos.get("o"), sala.codigo, sala.id);
    expect(atualizada.tabuleiro[4]).toBe("X");
    expect(atualizada.suaVez).toBe(true);
  } finally {
    for (const cliente of clientes) cliente.terminate();
    await new Promise((resolve) => servidor.close(resolve));
  }
});

test("envia a jogada durante uma consulta pendente e não aplica a resposta antiga", async () => {
  const inicial = { id: "partida", versao: 1 };
  const atual = { ...inicial, versao: 2 };
  const resposta = (sala) => ({ ok: true, json: async () => sala });
  let concluirConsulta;
  const consultaPendente = new Promise((resolve) => { concluirConsulta = resolve; });
  const apiFetch = jest.fn()
    .mockResolvedValueOnce(resposta(inicial))
    .mockReturnValueOnce(consultaPendente)
    .mockResolvedValueOnce(resposta(atual));
  const estados = [];
  const contexto = createContext({
    apiFetch,
    estados,
    URLSearchParams,
    sessionStorage: { getItem: () => null, setItem: jest.fn() },
    verificarSessaoPagina: async () => ({}),
    window: { location: { search: "?codigo=123" }, setInterval: jest.fn() },
    document: { getElementById: () => ({ addEventListener() {} }), querySelectorAll: () => [] },
  });
  runInContext(readFileSync(join(__dirname, "../View/js/sala.js"), "utf8"), contexto);
  runInContext("renderizar = (sala) => { estado = sala; estados.push(sala); };", contexto);
  await new Promise((resolve) => setImmediate(resolve));

  const aguardandoConsulta = contexto.atualizar();
  await contexto.agir("jogar", { casa: 4 });
  expect(apiFetch).toHaveBeenLastCalledWith("/api/salas/123/acoes", expect.objectContaining({ method: "POST" }));
  concluirConsulta(resposta(inicial));
  await aguardandoConsulta;
  expect(estados).toEqual([inicial, atual]);
});
