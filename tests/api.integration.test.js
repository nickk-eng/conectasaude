jest.mock("../Config/banco", () => ({}));
jest.mock("../Service/mfaService", () => ({}));
jest.mock("../Model/sessaoModel", () => ({ buscarUsuarioPorToken: jest.fn() }));
jest.mock("../Model/turmaModel", () => ({ listar: jest.fn() }));

const { createServer } = require("node:http");
const { Duplex } = require("node:stream");
const app = require("../app");
const sessoes = require("../Model/sessaoModel");

function requisitar(rota, { metodo = "GET", corpo, token, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const partes = [];
    const socket = new Duplex({
      read() {},
      write(chunk, _encoding, callback) {
        partes.push(chunk);
        callback();
      },
    });
    socket.once("error", reject);
    socket.once("finish", () => {
      const resposta = Buffer.concat(partes).toString("utf8");
      socket.destroy();
      resolve(resposta);
    });

    const cabecalhos = [
      `${metodo} ${rota} HTTP/1.1`,
      "Host: localhost",
      "Connection: close",
    ];
    if (token) cabecalhos.push(`Authorization: Bearer ${token}`);
    if (cookie) cabecalhos.push(`Cookie: conectaSaudeSessao=${cookie}`);
    if (corpo !== undefined) {
      cabecalhos.push("Content-Type: application/json", `Content-Length: ${Buffer.byteLength(corpo)}`);
    }
    createServer(app).emit("connection", socket);
    socket.push(cabecalhos.join("\r\n") + "\r\n\r\n" + (corpo ?? ""));
  });
}

test.each([
  "/api/avaliacao/status",
  "/api/jogo/perguntas",
  "/api/privacidade/solicitacoes",
  "/api/admin/resumo",
])("responde 401 sem sessão em %s", async (rota) => {
  const resposta = await requisitar(rota);
  expect(resposta).toMatch(/^HTTP\/1\.1 401 /);
  expect(resposta).toMatch(/\r\nX-Content-Type-Options: nosniff\r\n/i);
  expect(JSON.parse(resposta.split("\r\n\r\n")[1])).toHaveProperty("mensagem");
});

test("rejeita JSON inválido antes de chamar o login", async () => {
  const resposta = await requisitar("/api/auth/login", { metodo: "POST", corpo: "{" });
  expect(resposta).toMatch(/^HTTP\/1\.1 400 /);
  expect(JSON.parse(resposta.split("\r\n\r\n")[1])).toHaveProperty("mensagem");
});

test("abre a tela de turmas sem usar o cookie legado de outra aba", async () => {
  const resposta = await requisitar("/minha-turma", {
    cookie: "00000000-0000-4000-8000-000000000001",
  });
  expect(resposta).toMatch(/^HTTP\/1\.1 200 /);
  expect(resposta).toContain('data-perfis="professor"');
  expect(sessoes.buscarUsuarioPorToken).not.toHaveBeenCalled();
});

test("mantém a API de turmas protegida pelo perfil do token da aba", async () => {
  const tokenAluno = "00000000-0000-4000-8000-000000000001";
  const tokenProfessor = "00000000-0000-4000-8000-000000000002";
  sessoes.buscarUsuarioPorToken.mockResolvedValueOnce({ id: "aluno", perfil: "aluno" });
  const resposta = await requisitar("/api/professor/turmas", {
    token: tokenAluno, cookie: tokenProfessor,
  });
  expect(resposta).toMatch(/^HTTP\/1\.1 403 /);
  expect(sessoes.buscarUsuarioPorToken).toHaveBeenCalledWith(tokenAluno);
});
