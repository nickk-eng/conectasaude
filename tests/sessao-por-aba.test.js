const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { createContext, runInContext } = require("node:vm");

const script = readFileSync(join(__dirname, "../View/js/auth.js"), "utf8");
const destinos = { aluno: "/home", professor: "/home", admin: "/admin" };

function criarAba(perfis, sessao) {
  const dados = new Map();
  const sessionStorage = {
    getItem: (chave) => dados.get(chave) ?? null,
    setItem: (chave, valor) => dados.set(chave, valor),
    removeItem: (chave) => dados.delete(chave),
  };
  const body = { dataset: { perfis } };
  const replace = jest.fn();
  const fetch = jest.fn(async (_url, opcoes) => {
    const autenticada = sessao && opcoes.headers.get("Authorization") === "Bearer " + sessao.token;
    return {
      status: autenticada ? 200 : 401,
      ok: Boolean(autenticada),
      json: async () => ({ usuario: sessao, destino: destinos[sessao.perfil] }),
    };
  });
  const aba = createContext({ document: { body }, window: { location: { replace } }, sessionStorage, Headers, fetch });
  runInContext(script, aba);
  return { aba, body, fetch, replace, sessionStorage };
}

test("duas contas de aluno, professor e admin navegam com sessões independentes", async () => {
  const contas = [
    { token: "aluno-1", perfil: "aluno", perfis: "aluno professor" },
    { token: "aluno-2", perfil: "aluno", perfis: "aluno" },
    { token: "professor-1", perfil: "professor", perfis: "professor" },
    { token: "admin-1", perfil: "admin", perfis: "admin" },
  ];
  const abas = contas.map((conta) => {
    const guia = criarAba(conta.perfis, { ...conta, aguardandoAprovacao: false });
    guia.aba.salvarToken(conta.token);
    return guia;
  });
  await Promise.all(abas.map(async (guia, indice) => {
    await expect(guia.aba.verificarSessaoPagina()).resolves.toMatchObject({ usuario: { token: contas[indice].token } });
    expect(guia.body.dataset.sessaoValidada).toBe("true");
    expect(guia.replace).not.toHaveBeenCalled();
  }));
  abas[3].aba.removerToken();
  expect(abas[2].sessionStorage.getItem("conectaSaudeToken")).toBe("professor-1");
});

test("aluno que abre a tela de turmas volta para seu painel", async () => {
  const { aba, body, replace } = criarAba("professor", { token: "aluno-1", perfil: "aluno", aguardandoAprovacao: false });
  aba.salvarToken("aluno-1");
  await expect(aba.verificarSessaoPagina()).resolves.toBeNull();
  expect(replace).toHaveBeenCalledWith("/home");
  expect(body.dataset.sessaoValidada).toBeUndefined();
});

test("aba sem token vai para a tela de login", async () => {
  const { aba, fetch, replace } = criarAba("admin");
  await expect(aba.verificarSessaoPagina()).resolves.toBeNull();
  expect(replace).toHaveBeenCalledWith("/");
  expect(fetch).not.toHaveBeenCalled();
});
