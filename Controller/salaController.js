const { criarServicoSalas } = require('../Service/salaService');
const perguntasModel = require('../Model/perguntaModel');
const { salvarResultados } = require('../Model/salaModel');
const salas = criarServicoSalas({ perguntasModel, salvarResultados });

async function executar(res, operacao, status = 200) {
  try {
    res.status(status).json(await operacao());
  } catch (erro) {
    if (!erro.status) console.error('Erro na sala:', erro.message);
    res.status(erro.status || 503).json({ mensagem: erro.status ? erro.message : 'Não foi possível salvar ou atualizar a sala. Tente novamente.' });
  }
}

module.exports = {
  criar: (req, res) => executar(res, () => salas.criar(req.usuario, req.body.nivel, req.body.codigo, req.body.categoriaIst), 201),
  entrar: (req, res) => executar(res, () => salas.entrar(req.usuario, req.body.codigo)),
  consultar: (req, res) => executar(res, () => salas.consultar(req.usuario, req.params.codigo, req.query.partida)),
  agir: (req, res) => executar(res, () => salas.agir(req.usuario, req.params.codigo, req.body))
};
