const auditoriaModel = require('../Model/auditoriaModel');

function ipCliente(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
    .split(',')[0]
    .trim();
}

async function registrarAuditoria(req, acao, recurso, detalhes = {}, usuarioInformado = null) {
  try {
    const usuario = usuarioInformado || req.usuario || null;
    await auditoriaModel.registrar({
      usuarioId: usuario?.id || null,
      usuarioEmail: usuario?.email || detalhes.email || null,
      perfil: usuario?.perfil || null,
      acao,
      recurso,
      detalhes: detalhes || {},
      metodo: req.method,
      rota: req.originalUrl,
      ip: ipCliente(req),
      userAgent: String(req.get('User-Agent') || '').slice(0, 300)
    });
  } catch (erro) {
    console.error('Erro ao registrar auditoria:', erro.message);
  }
}

module.exports = { registrarAuditoria };
