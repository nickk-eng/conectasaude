// Limite por IP para uma instância do servidor. Em múltiplas instâncias,
// usar armazenamento compartilhado para manter o mesmo limite.
function limitarTentativas(maximo, janelaMs = 15 * 60 * 1000) {
  const acessos = new Map();
  return (req, res, next) => {
    const agora = Date.now();
    for (const [chave, item] of acessos) if (item.expira <= agora) acessos.delete(chave);
    const chave = req.ip;
    const item = acessos.get(chave) || { total: 0, expira: agora + janelaMs };
    acessos.set(chave, item);
    if (++item.total > maximo) {
      res.set('Retry-After', String(Math.ceil((item.expira - agora) / 1000)));
      return res.status(429).json({ mensagem: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' });
    }
    next();
  };
}

module.exports = { limitarTentativas };
