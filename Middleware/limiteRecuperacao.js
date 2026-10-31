// Limite adicional por IP; o intervalo por conta também é persistido no banco.
const acessos = new Map();
function limiteRecuperacao(req, res, next) {
  const agora = Date.now();
  for (const [ip, item] of acessos) if (item.expira <= agora) acessos.delete(ip);
  const chave = req.ip;
  const item = acessos.get(chave) || { total: 0, expira: agora + 15 * 60 * 1000 };
  acessos.set(chave, item);
  if (++item.total > 30) {
    res.set('Retry-After', String(Math.ceil((item.expira - agora) / 1000)));
    return res.status(429).json({ mensagem: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' });
  }
  next();
}
module.exports = { limiteRecuperacao };
