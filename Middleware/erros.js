function tratarErros(erro, _req, res, next) {
  if (res.headersSent) return next(erro);

  const status = erro.status >= 400 && erro.status < 500 ? erro.status : 500;
  if (status === 500) console.error('Erro não tratado:', erro.message);

  res.status(status).json({
    mensagem: status === 500 ? 'Erro interno do servidor.' : 'Requisição inválida.'
  });
}

module.exports = { tratarErros };
