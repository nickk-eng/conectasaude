const usuarioModel = require('../Model/usuarioModel');
const { ANOS_ENSINO_MEDIO } = require('../Config/constantes');
const auditoriaModel = require('../Model/auditoriaModel');
const { registrarAuditoria } = require('../Service/auditoriaService');

// PUT /api/usuario/perfil (aluno ou professor)
async function atualizarPerfil(req, res) {
  const ehAluno = req.usuario.perfil === 'aluno';
  const nome = String(req.body.nome || '').trim().slice(0, 60);
  const turma = ehAluno ? String(req.body.turma ?? req.usuario.turma ?? '').trim().slice(0, 60) : '';

  if (!nome) return res.status(400).json({ mensagem: 'Informe seu nome.' });
  if (ehAluno && !ANOS_ENSINO_MEDIO.includes(turma)) return res.status(400).json({ mensagem: 'Selecione o 1º, 2º ou 3º ano do ensino médio.' });

  const usuario = await usuarioModel.atualizarPerfil(req.usuario.id, nome, turma);
  if (!usuario) return res.status(409).json({ mensagem: 'O ano escolar já foi definido e não pode ser alterado.' });
  await registrarAuditoria(req, 'perfil_atualizado', req.usuario.perfil, { informouNome: true, informouTurma: Boolean(turma) });
  res.json({ usuario: usuarioModel.paraPublico(usuario) });
}

// PUT /api/aluno/perfil (usado pela tela do jogo; o nome é opcional)
async function atualizarPerfilAluno(req, res) {
  const nome = String(req.body.nome || '').trim().slice(0, 60);
  const turma = String(req.body.turma ?? req.usuario.turma ?? '').trim().slice(0, 60);

  if (!ANOS_ENSINO_MEDIO.includes(turma)) return res.status(400).json({ mensagem: 'Selecione o 1º, 2º ou 3º ano do ensino médio.' });

  const usuario = await usuarioModel.atualizarPerfil(req.usuario.id, nome, turma);
  if (!usuario) return res.status(409).json({ mensagem: 'O ano escolar já foi definido e não pode ser alterado.' });
  await registrarAuditoria(req, 'perfil_atualizado', 'aluno', { turma, informouNome: Boolean(nome) });
  res.json({ usuario: usuarioModel.paraPublico(usuario) });
}

async function historico(req, res) {
  const pagina = Number(req.query.pagina || 1);
  if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > 1000000) {
    return res.status(400).json({ mensagem: 'Página inválida.' });
  }
  res.json(await auditoriaModel.historicoAluno(req.usuario.id, pagina));
}

async function solicitarProfessor(req, res) {
  const usuario = await usuarioModel.solicitarProfessor(req.usuario.id);
  if (!usuario) return res.status(409).json({ mensagem: 'Já existe uma solicitação pendente ou seu perfil foi alterado. Atualize a página.' });
  await registrarAuditoria(req, 'professor_solicitado', 'usuarios');
  res.status(201).json({ mensagem: 'Solicitação enviada ao administrador.', usuario: usuarioModel.paraPublico(usuario) });
}

module.exports = { atualizarPerfil, atualizarPerfilAluno, historico, solicitarProfessor };
