const perguntaModel = require('../Model/perguntaModel');
const partidaModel = require('../Model/partidaModel');
const { registrarAuditoria } = require('../Service/auditoriaService');
const { NIVEIS, CATEGORIAS_IST } = require('../Config/constantes');

async function listarPerguntas(req, res) {
  const nivel = NIVEIS.includes(req.query.nivel) ? req.query.nivel : null;
  const categoriaIst = CATEGORIAS_IST.some((categoria) => categoria.valor === req.query.categoriaIst) ? req.query.categoriaIst : null;
  const perguntas = await perguntaModel.sortearAprovadas(nivel, categoriaIst);
  await registrarAuditoria(req, 'jogo_iniciado', 'jogo', { nivel: nivel || 'todos', categoriaIst: categoriaIst || 'todas', perguntas: perguntas.length });

  res.json({
    perguntas: perguntas.map((pergunta) => ({
      texto: pergunta.texto,
      opcoes: typeof pergunta.alternativas === 'string' ? JSON.parse(pergunta.alternativas) : pergunta.alternativas,
      certa: pergunta.resposta_correta
    }))
  });
}

const contagem = (valor) => Math.min(Math.max(Math.trunc(Number(valor)) || 0, 0), 1000);

async function registrarResultado(req, res) {
  const acertos = contagem(req.body.acertos);
  const erros = contagem(req.body.erros);
  const nivel = NIVEIS.includes(req.body.nivel) ? req.body.nivel : 'Fácil';
  const modo = ['colega', 'computador'].includes(req.body.modo) ? req.body.modo : 'computador';
  const resultado = String(req.body.resultado || '').trim().slice(0, 80);

  await partidaModel.registrar({ usuarioId: req.usuario.id, acertos, erros, nivel, modo, resultado });
  await registrarAuditoria(req, 'jogo_finalizado', 'jogo', { acertos, erros, nivel, modo, resultado });
  res.status(204).end();
}

module.exports = { listarPerguntas, registrarResultado };
