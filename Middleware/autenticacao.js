const sessaoModel = require("../Model/sessaoModel");
const {
  aguardaAprovacao,
  destinoUsuario,
} = require("../Service/acessoService");
const TOKEN_VALIDO =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COOKIE_SESSAO = "conectaSaudeSessao";
const opcoesCookie = {
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

function gravarCookieSessao(res, token) {
  res.cookie(COOKIE_SESSAO, token, {
    ...opcoesCookie,
    maxAge: 8 * 60 * 60 * 1000,
  });
}

function limparCookieSessao(res) {
  res.clearCookie(COOKIE_SESSAO, opcoesCookie);
}

function extrairToken(req) {
  const [tipo, token] = String(req.get("Authorization") || "")
    .trim()
    .split(/\s+/, 2);
  return tipo === "Bearer" && TOKEN_VALIDO.test(token || "") ? token : null;
}

async function autenticarSessao(req, res, next) {
  const token = extrairToken(req);
  const usuario = token ? await sessaoModel.buscarUsuarioPorToken(token) : null;

  if (!usuario) {
    return res.status(401).json({ mensagem: "Faça login para continuar." });
  }

  req.usuario = usuario;
  res.set("Cache-Control", "no-store");
  next();
}

function autenticar(req, res, next) {
  return autenticarSessao(req, res, () => {
    if (aguardaAprovacao(req.usuario)) {
      return res
        .status(403)
        .json({
          mensagem:
            "Aguardando o administrador aceitar a sua solicitação, prezado professor",
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

function protegerPaginaComSessao(perfis, espera = false) {
  return async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    const cookie = String(req.headers.cookie || "")
      .split(";")
      .map((parte) => parte.trim())
      .find((parte) => parte.startsWith(`${COOKIE_SESSAO}=`));
    const token = cookie?.slice(COOKIE_SESSAO.length + 1);
    const usuario = TOKEN_VALIDO.test(token || "")
      ? await sessaoModel.buscarUsuarioPorToken(token)
      : null;
    if (!usuario) {
      limparCookieSessao(res);
      return res.redirect("/");
    }
    if (aguardaAprovacao(usuario)) {
      if (!espera) return res.redirect("/aguardando-aprovacao");
    } else if (espera || !perfis.includes(usuario.perfil)) {
      return res.redirect(destinoUsuario(usuario));
    }
    req.usuario = usuario;
    next();
  };
}

function protegerPagina(...perfis) {
  return protegerPaginaComSessao(perfis);
}

const protegerEspera = protegerPaginaComSessao([], true);

module.exports = {
  autenticar,
  autenticarSessao,
  permitir,
  extrairToken,
  protegerPagina,
  protegerEspera,
  gravarCookieSessao,
  limparCookieSessao,
};
