const avaliacaoService = require('../Service/avaliacaoService');

// O aluno só joga depois de concluir o pré-teste.
async function exigirPreTeste(req, res, next) {
  if (await avaliacaoService.preTesteConcluido(req.usuario.id)) return next();
  res.status(403).json({ mensagem: 'Faça o pré-teste antes de jogar.', codigo: 'PRE_TESTE_PENDENTE' });
}

module.exports = { exigirPreTeste };
