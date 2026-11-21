const acesso = require("../Service/acessoService");
const senha = require("../Service/senhaService");

test.each([
  [{ perfil: "aluno", status_professor: "nao_aplicavel" }, "/home"],
  [{ perfil: "aluno", status_professor: "pendente" }, "/aguardando-aprovacao"],
  [{ perfil: "aluno", solicitou_professor: true }, "/aguardando-aprovacao"],
  [{ perfil: "admin" }, "/admin"],
  [{ perfil: "professor" }, "/home"],
])("define o destino de %o", (usuario, destino) => {
  expect(acesso.destinoUsuario(usuario)).toBe(destino);
});

test.each([undefined, "Curta1!", "semmaiuscula1!", "SemNumero!", "SemEspecial1", "A1!" + "é".repeat(35)])(
  "rejeita senha fora dos requisitos (%p)",
  (valor) => {
    expect(senha.senhaForte(valor)).toBe(false);
  },
);

test("gera hash e confere a senha", async () => {
  const valor = "Exemplo1!";
  expect(senha.senhaForte(valor)).toBe(true);
  const hash = await senha.gerarHash(valor);
  expect(hash).not.toBe(valor);
  await expect(senha.conferir(valor, hash)).resolves.toBe(true);
  await expect(senha.conferir("Outra1!", hash)).resolves.toBe(false);
});
