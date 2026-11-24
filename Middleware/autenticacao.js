const sessaoModel = require("../Model/sessaoModel");
const {
  aguardaAprovacao,
} = require("../Service/acessoService");
const TOKEN_VALIDO =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function extrairToken(req) {
  const [tipo, token] = String(req.get("Authorization") || "")
    .trim()
    .split(/\s+/, 2);
  return tipo === "Bearer" && TOKEN_VALIDO.test(token || "") ? token : null;
}

async function autenticarSessao(req, res, next) {
  const token = extrairToken(req);
  const usuario = await buscarUsuarioDaSessao(token);

  if (!usuario) {
    return res.status(401).json({ mensagem: "Faça login para continuar." });
  }

  req.usuario = usuario;
  res.set("Cache-Control", "no-store");
  next();
}

function buscarUsuarioDaSessao(token) {
  return typeof token === "string" && TOKEN_VALIDO.test(token)
    ? sessaoModel.buscarUsuarioPorToken(token)
    : null;
}

function autenticar(req, res, next) {
  return autenticarSessao(req, res, () => {
    if (aguardaAprovacao(req.usuario)) {
      return res
        .status(403)
        .json({
          mensagem:
            "Sua solicitação de acesso está em análise.",
          codigo: "APROVACAO_PROFESSOR_PENDENTE",
          destino: "/aguardando-aprovacao",
        });
    }
    next();
  });
}

function permitir(...perfis) {
  return (req, res, next) =>
    perfis.includes(req.usuario?.perfil)
      ? next()
      : res.status(403).json({ mensagem: "Você não tem acesso a esta área." });
}

module.exports = {
  autenticar,
  autenticarSessao,
  permitir,
  extrairToken,
  buscarUsuarioDaSessao,
};
