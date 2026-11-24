const usuarioModel = require("../Model/usuarioModel");
const perguntaModel = require("../Model/perguntaModel");
const senhaService = require("../Service/senhaService");
const { AUTOR_SEMENTE_ID } = require("../Config/constantes");

async function prepararBanco() {
}

async function garantirAdmin(email, senha) {
  let existente = await usuarioModel.buscarAtivoPorEmail(email);
  if (!existente) {
    const id = await usuarioModel.criarAdmin(
      email,
      await senhaService.gerarHash(senha),
    );
    if (id) return id;
    existente = await usuarioModel.buscarAtivoPorEmail(email);
  }
  if (!existente) {
    throw new Error("O e-mail configurado para administrador pertence a uma conta inativa.");
  }
  if (existente.perfil !== "admin") {
    throw new Error(
      "O e-mail configurado para administrador já pertence a uma conta de outro perfil.",
    );
  }
  return existente.id;
}

async function criarAdmin() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const emailAdicional = (process.env.ADMIN_EMAIL_ADICIONAL || "").trim().toLowerCase();
  const senhaAdicional = process.env.ADMIN_SENHA_ADICIONAL;
  if (Boolean(emailAdicional) !== Boolean(senhaAdicional)) {
    throw new Error("Configure ADMIN_EMAIL_ADICIONAL e ADMIN_SENHA_ADICIONAL em conjunto.");
  }
  if (emailAdicional && emailAdicional === email) {
    throw new Error("O administrador adicional precisa de um e-mail diferente do principal.");
  }

  if (email && process.env.ADMIN_SENHA) {
    const emailAnterior = (process.env.ADMIN_EMAIL_ANTERIOR || "")
      .trim()
      .toLowerCase();

    if (emailAnterior && emailAnterior !== email) {
      await usuarioModel.alterarEmailAdmin(emailAnterior, email);
    }
    const adminId = await garantirAdmin(email, process.env.ADMIN_SENHA);
    await perguntaModel.reatribuirAutor(AUTOR_SEMENTE_ID, adminId);
    await usuarioModel.excluir(AUTOR_SEMENTE_ID);
  }

  if (emailAdicional) await garantirAdmin(emailAdicional, senhaAdicional);
}

module.exports = { prepararBanco, criarAdmin };
