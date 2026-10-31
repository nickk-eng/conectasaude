const usuarioModel = require('../Model/usuarioModel');
const perguntaModel = require('../Model/perguntaModel');
const avaliacaoModel = require('../Model/avaliacaoModel');
const avaliacaoService = require('../Service/avaliacaoService');
const { registrarAuditoria } = require('../Service/auditoriaService');
const { NIVEIS, CATEGORIAS_IST } = require('../Config/constantes');
const auditoriaModel = require('../Model/auditoriaModel');

async function listarAlunos(req, res) {
  const alunos = await usuarioModel.listarAlunos();
  await registrarAuditoria(req, 'alunos_consultados', 'professor', { total: alunos.length });
  res.json({ alunos: alunos.map(usuarioModel.paraPublico) });
}

async function atualizarResponsaveisAluno(req, res) {
  const id = String(req.params.id || '');
  const nomes = String(req.body.nomes || '').trim().slice(0, 240);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return res.status(400).json({ mensagem: 'Aluno inválido.' });
  }
  const aluno = await usuarioModel.atualizarResponsaveisAluno(id, nomes);
  if (!aluno) return res.status(404).json({ mensagem: 'Aluno não encontrado.' });
  await registrarAuditoria(req, 'responsaveis_aluno_atualizados', 'aluno', {
    alunoId: aluno.id,
    informouNomes: Boolean(aluno.responsaveis_nome)
  });
  res.json({ mensagem: 'Responsáveis atualizados.' });
}

async function listarAvaliacoes(req, res) {
  const resumo = avaliacaoService.resumirTurma(await avaliacaoModel.resumoPorAluno());
  await registrarAuditoria(req, 'avaliacoes_consultadas', 'professor', { total: resumo.alunos.length });
  res.json(resumo);
}

async function indicadoresIsts(req, res) {
  const contagens = await perguntaModel.indicadoresPorCategoria();
  const porCategoria = new Map(contagens.map((item) => [item.categoria_ist, item]));
  await registrarAuditoria(req, 'indicadores_ists_consultados', 'perguntas', { categorias: CATEGORIAS_IST.length });
  res.json({ indicadores: CATEGORIAS_IST.map((categoria) => ({
    ...categoria,
    ...(porCategoria.get(categoria.valor) || { total: 0, aprovadas: 0, pendentes: 0, recusadas: 0 })
  })) });
}

async function relatorios(req, res) {
  const turma = String(req.query.turma || '').trim().slice(0, 60);
  const dataValida = (valor) => {
    if (!valor) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
    const data = new Date(`${valor}T00:00:00Z`);
    return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
  };
  const de = String(req.query.de || '');
  const ate = String(req.query.ate || '');
  if (!dataValida(de) || !dataValida(ate) || (de && ate && de > ate)) {
    return res.status(400).json({ mensagem: 'Informe um período válido.' });
  }
  const alunos = await auditoriaModel.relatorioProfessor({ turma, de: de || null, ate: ate || null });
  await registrarAuditoria(req, 'relatorios_consultados', 'professor', { turma, de: de || null, ate: ate || null });
  res.json({ alunos });
}

async function criarPergunta(req, res) {
  const texto = String(req.body.texto || '').trim().slice(0, 500);
  const alternativas = Array.isArray(req.body.alternativas)
    ? req.body.alternativas.map((item) => String(item || '').trim().slice(0, 200))
    : [];
  const respostaCorreta = Number(req.body.respostaCorreta);
  const nivel = NIVEIS.includes(req.body.nivel) ? req.body.nivel : 'Fácil';
  const categoriaIst = req.body.categoriaIst;

  if (!CATEGORIAS_IST.some((categoria) => categoria.valor === categoriaIst)) {
    return res.status(400).json({ mensagem: 'Escolha uma categoria de IST válida.' });
  }

  if (texto.length < 10) {
    return res.status(400).json({ mensagem: 'Escreva uma pergunta com pelo menos 10 caracteres.' });
  }

  if (alternativas.length !== 3 || alternativas.some((item) => !item)) {
    return res.status(400).json({ mensagem: 'Preencha as três alternativas.' });
  }

  if (req.body.respostaCorreta === '' || !Number.isInteger(respostaCorreta) || respostaCorreta < 0 || respostaCorreta > 2) {
    return res.status(400).json({ mensagem: 'Escolha a resposta correta.' });
  }

  const id = await perguntaModel.criar({ texto, alternativas, respostaCorreta, nivel, categoriaIst, autorId: req.usuario.id });
  await registrarAuditoria(req, 'pergunta_criada', 'perguntas', { perguntaId: id, nivel, categoriaIst });

  res.status(201).json({ mensagem: 'Pergunta enviada para aprovação do administrador.', id });
}

module.exports = { listarAlunos, atualizarResponsaveisAluno, listarAvaliacoes, indicadoresIsts, relatorios, criarPergunta };
