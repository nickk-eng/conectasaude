const avaliacaoService = require('../Service/avaliacaoService');
const { registrarAuditoria } = require('../Service/auditoriaService');
const { TIPOS_AVALIACAO } = require('../Config/constantes');

function responderErro(res, erro) {
  if (erro instanceof avaliacaoService.ErroRegra) {
    return res.status(erro.status).json({ mensagem: erro.message, codigo: erro.codigo });
  }
  throw erro; // erro inesperado: vai para o tratador global
}

function tipoDaRota(req, res) {
  if (TIPOS_AVALIACAO.includes(req.params.tipo)) return req.params.tipo;
  res.status(404).json({ mensagem: 'Avaliação não encontrada.' });
  return null;
}

async function status(req, res) {
  res.json(await avaliacaoService.status(req.usuario.id));
}

async function iniciar(req, res) {
  const tipo = tipoDaRota(req, res);
  if (!tipo) return;

  try {
    const avaliacao = await avaliacaoService.iniciar(req.usuario.id, tipo);
    if (avaliacao.criada) {
      await registrarAuditoria(req, 'avaliacao_iniciada', 'avaliacao', { tipo, total: avaliacao.total });
    }
    res.json(avaliacao);
  } catch (erro) {
    responderErro(res, erro);
  }
}

async function responder(req, res) {
  const tipo = tipoDaRota(req, res);
  if (!tipo) return;

  try {
    const resultado = await avaliacaoService.responder(req.usuario.id, tipo, req.body.respostas);
    await registrarAuditoria(req, 'avaliacao_concluida', 'avaliacao', {
      tipo,
      acertos: resultado.acertos,
      total: resultado.total
    });
    res.json(resultado);
  } catch (erro) {
    responderErro(res, erro);
  }
}

module.exports = { status, iniciar, responder };
