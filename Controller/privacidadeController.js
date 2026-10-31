const privacidadeModel = require('../Model/privacidadeModel');
const { registrarAuditoria } = require('../Service/auditoriaService');
const { TIPOS_SOLICITACAO_PRIVACIDADE } = require('../Config/constantes');

async function criarSolicitacao(req, res) {
  const tipo = String(req.body.tipo || '');
  const mensagem = String(req.body.mensagem || '').trim().slice(0, 1000);

  if (!TIPOS_SOLICITACAO_PRIVACIDADE.includes(tipo)) {
    return res.status(400).json({ mensagem: 'Selecione um tipo de solicitação válido.' });
  }

  try {
    const solicitacaoId = await privacidadeModel.criar({ usuarioId: req.usuario.id, tipo, mensagem });
    await registrarAuditoria(req, 'solicitacao_privacidade_criada', 'privacidade', { solicitacaoId, tipo });
    res.status(201).json({ mensagem: 'Solicitação registrada para análise da equipe do projeto.' });
  } catch (erro) {
    console.error('Erro ao registrar solicitação de privacidade:', erro.message);
    res.status(503).json({ mensagem: 'Não foi possível registrar a solicitação. Tente novamente.' });
  }
}

module.exports = { criarSolicitacao };
