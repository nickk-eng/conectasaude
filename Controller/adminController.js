const perguntaModel = require('../Model/perguntaModel');
const privacidadeModel = require('../Model/privacidadeModel');
const auditoriaModel = require('../Model/auditoriaModel');
const { registrarAuditoria } = require('../Service/auditoriaService');
const usuarioModel = require('../Model/usuarioModel');
const { NIVEIS, CATEGORIAS_IST } = require('../Config/constantes');
const sessaoModel = require('../Model/sessaoModel');

function validarPergunta(body = {}) {
  const texto = String(body.texto || '').trim().slice(0, 500);
  const alternativas = Array.isArray(body.alternativas)
    ? body.alternativas.map((item) => String(item || '').trim().slice(0, 200)) : [];
  const respostaCorreta = Number(body.respostaCorreta);
  const nivel = NIVEIS.includes(body.nivel) ? body.nivel : null;
  const categoriaIst = body.categoriaIst;
  const status = body.status || 'aprovada';
  if (texto.length < 10 || alternativas.length !== 3 || alternativas.some((item) => !item)
      || !Number.isInteger(respostaCorreta) || respostaCorreta < 0 || respostaCorreta >= alternativas.length
      || !nivel || !CATEGORIAS_IST.some((categoria) => categoria.valor === categoriaIst)
      || !['pendente', 'aprovada', 'recusada'].includes(status)) return null;
  return { texto, alternativas, respostaCorreta, nivel, categoriaIst, status };
}

async function listarUsuarios(req, res) {
  const usuarios = await usuarioModel.listarParaAdmin();
  await registrarAuditoria(req, 'usuarios_consultados', 'admin', { total: usuarios.length });
  res.json({ usuarios });
}

async function atualizarUsuario(req, res) {
  if (req.params.id === req.usuario.id && req.body.ativo === false) {
    return res.status(400).json({ mensagem: 'Você não pode desativar sua própria conta.' });
  }
  if (typeof req.body.ativo !== 'boolean') return res.status(400).json({ mensagem: 'Informe se a conta deve ficar ativa.' });
  let usuario;
  try { usuario = await usuarioModel.definirAtivo(req.params.id, req.body.ativo); }
  catch (erro) {
    if (erro.code === '23505') return res.status(409).json({ mensagem: 'Já existe uma conta ativa com este e-mail.' });
    throw erro;
  }
  if (!usuario) return res.status(404).json({ mensagem: 'Usuário não encontrado.' });
  if (!usuario.ativo) await sessaoModel.removerDoUsuario(usuario.id);
  await registrarAuditoria(req, usuario.ativo ? 'usuario_reativado' : 'usuario_desativado', 'usuarios', { usuarioId: usuario.id });
  res.json({ usuario });
}

async function criarPergunta(req, res) {
  const pergunta = validarPergunta(req.body);
  if (!pergunta) return res.status(400).json({ mensagem: 'Informe a pergunta, três alternativas, a resposta correta, o nível, a categoria e o status.' });
  const id = await perguntaModel.criarComoAdmin({ ...pergunta, autorId: req.usuario.id });
  await registrarAuditoria(req, 'pergunta_criada_admin', 'perguntas', { perguntaId: id, categoriaIst: pergunta.categoriaIst, status: pergunta.status });
  res.status(201).json({ mensagem: 'Pergunta cadastrada com sucesso.', id });
}

async function atualizarPergunta(req, res) {
  const pergunta = validarPergunta(req.body);
  if (!pergunta) return res.status(400).json({ mensagem: 'Informe a pergunta, três alternativas, a resposta correta, o nível, a categoria e o status.' });
  if (!await perguntaModel.atualizarComoAdmin(req.params.id, pergunta, req.usuario.id)) {
    return res.status(404).json({ mensagem: 'Pergunta não encontrada.' });
  }
  await registrarAuditoria(req, 'pergunta_editada_admin', 'perguntas', { perguntaId: req.params.id, categoriaIst: pergunta.categoriaIst });
  res.json({ mensagem: 'Pergunta atualizada com sucesso.' });
}

async function excluirPergunta(req, res) {
  if (!await perguntaModel.excluirComoAdmin(req.params.id)) return res.status(404).json({ mensagem: 'Pergunta não encontrada.' });
  await registrarAuditoria(req, 'pergunta_excluida_admin', 'perguntas', { perguntaId: req.params.id });
  res.json({ mensagem: 'Pergunta excluída com sucesso.' });
}

async function listarPerguntas(req, res) {
  const perguntas = await perguntaModel.listarParaAdmin();
  await registrarAuditoria(req, 'perguntas_consultadas', 'admin', { total: perguntas.length });
  res.json({ perguntas });
}

async function avaliarPergunta(req, res) {
  const status = req.body.status;

  if (!['aprovada', 'recusada'].includes(status)) {
    return res.status(400).json({ mensagem: 'Status inválido.' });
  }

  const avaliada = await perguntaModel.avaliar(req.params.id, status, req.usuario.id);
  if (!avaliada) {
    return res.status(404).json({ mensagem: 'Pergunta pendente não encontrada.' });
  }
  await registrarAuditoria(req, 'pergunta_avaliada', 'perguntas', { perguntaId: req.params.id, status });

  res.json({ mensagem: `Pergunta ${status === 'aprovada' ? 'aprovada' : 'recusada'} com sucesso.` });
}

async function listarSolicitacoesPrivacidade(_req, res) {
  try {
    res.json({ solicitacoes: await privacidadeModel.listar() });
  } catch (erro) {
    console.error('Erro ao consultar solicitações de privacidade:', erro.message);
    res.status(503).json({ mensagem: 'Não foi possível carregar as solicitações.' });
  }
}

async function listarAuditoria(req, res) {
  const limite = Math.min(Math.max(Number(req.query.limite) || 50, 1), 200);
  res.json({ logs: await auditoriaModel.listar(limite) });
}

module.exports = { listarPerguntas, avaliarPergunta, listarUsuarios, atualizarUsuario, criarPergunta, atualizarPergunta, excluirPergunta, listarSolicitacoesPrivacidade, listarAuditoria };
