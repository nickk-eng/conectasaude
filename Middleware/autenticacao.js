const sessaoModel = require('../Model/sessaoModel');

function extrairToken(req) {
  const [tipo, token] = String(req.get('Authorization') || '').trim().split(/\s+/, 2);
  return tipo === 'Bearer' && token ? token : null;
}

async function autenticar(req, res, next) {
  const token = extrairToken(req);
  const usuario = token ? await sessaoModel.buscarUsuarioPorToken(token) : null;

  if (!usuario) {
    return res.status(401).json({ mensagem: 'Faça login para continuar.' });
  }

  req.usuario = usuario;
  next();
}

function permitir(...perfis) {
  return (req, res, next) =>
    perfis.includes(req.usuario.perfil)
      ? next()
      : res.status(403).json({ mensagem: 'Você não tem acesso a esta área.' });
}

module.exports = { autenticar, permitir, extrairToken };
