const usuarioModel = require("../Model/usuarioModel");
const perguntaModel = require("../Model/perguntaModel");
const senhaService = require("../Service/senhaService");
const { AUTOR_SEMENTE_ID } = require("../Config/constantes");

async function prepararBanco() {
  // Estrutura e tabelas agora são criadas manualmente via arquivo .sql único no PostgreSQL
}

async function criarAdmin() {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_SENHA) return;

  const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
  const emailAnterior = String(process.env.ADMIN_EMAIL_ANTERIOR || "")
    .trim()
    .toLowerCase();

  if (emailAnterior && emailAnterior !== email) {
    await usuarioModel.alterarEmailAdmin(emailAnterior, email);
  }

  const existente = await usuarioModel.buscarAtivoPorEmail(email);
  if (existente && existente.perfil !== "admin") {
    throw new Error(
      "O e-mail configurado para administrador já pertence a uma conta de outro perfil.",
    );
  }

  let adminId = existente?.id;

  if (!adminId) {
    adminId = await usuarioModel.criarAdmin(
      email,
      await senhaService.gerarHash(process.env.ADMIN_SENHA),
    );
  }

  await perguntaModel.reatribuirAutor(AUTOR_SEMENTE_ID, adminId);
  await usuarioModel.excluir(AUTOR_SEMENTE_ID);
}

module.exports = { prepararBanco, criarAdmin };