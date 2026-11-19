const auditoriaModel = require("../Model/auditoriaModel");
const { mascararEmail } = require("../Utils/mascararEmail");

function mascararDetalhes(valor, chave = "") {
  if (Array.isArray(valor))
    return valor.map((item) => mascararDetalhes(item, chave));
  if (valor && typeof valor === "object")
    return Object.fromEntries(
      Object.entries(valor).map(([nome, item]) => [
        nome,
        mascararDetalhes(item, nome),
      ]),
    );
  if (typeof valor !== "string") return valor;
  if (/email/i.test(chave)) return mascararEmail(valor);
  return valor.replace(/[^\s<>"']+@[^\s<>"']+\.[^\s<>"']+/gi, mascararEmail);
}

function ipCliente(req) {
  return String(req.ip || req.socket.remoteAddress || "")
    .split(",")[0]
    .trim();
}

async function registrarAuditoria(
  req,
  acao,
  recurso,
  detalhes = {},
  usuarioInformado = null,
) {
  try {
    const usuario = usuarioInformado || req.usuario || null;
    await auditoriaModel.registrar({
      usuarioId: usuario?.id || null,
      usuarioEmail: mascararEmail(usuario?.email || detalhes.email || null),
      perfil: usuario?.perfil || null,
      acao,
      recurso,
      detalhes: mascararDetalhes(detalhes || {}),
      metodo: req.method,
      rota: req.originalUrl,
      ip: ipCliente(req),
      userAgent: String(req.get("User-Agent") || "").slice(0, 300),
    });
  } catch (erro) {
    console.error("Erro ao registrar auditoria:", erro.message);
  }
}

async function registrarRevelacaoEmail(req, acao, alvo) {
  const solicitante = req.usuario;
  await auditoriaModel.registrar({
    usuarioId: solicitante.id,
    usuarioEmail: solicitante.email,
    perfil: solicitante.perfil,
    acao,
    recurso: "usuarios",
    detalhes: {
      solicitanteNome: solicitante.nome || "",
      solicitantePerfil: solicitante.perfil,
      alvoId: alvo?.id || null,
      alvoNome: alvo?.nome || null,
      alvoEmail: alvo?.email || null,
    },
    metodo: req.method,
    rota: req.originalUrl,
    ip: ipCliente(req),
    userAgent: String(req.get("User-Agent") || "").slice(0, 300),
  });
}

module.exports = { registrarAuditoria, registrarRevelacaoEmail };
