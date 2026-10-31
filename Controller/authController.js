const usuarioModel = require('../Model/usuarioModel');
const sessaoModel = require('../Model/sessaoModel');
const desafioMfaModel = require('../Model/desafioMfaModel');
const senhaService = require('../Service/senhaService');
const mfaService = require('../Service/mfaService');
const { registrarAuditoria } = require('../Service/auditoriaService');
const { extrairToken, gravarCookieSessao, limparCookieSessao } = require('../Middleware/autenticacao');
const { VERSAO_TERMOS, PERFIS_CADASTRO, ANOS_ENSINO_MEDIO } = require('../Config/constantes');
const recuperacaoSenhaService = require('../Service/recuperacaoSenhaService');

async function cadastro(req, res) {
  const { email, senha, confirmarSenha, perfil = 'aluno', aceitouTermos } = req.body;
  const emailLimpo = String(email || '').trim().toLowerCase();

  if (!emailLimpo || !senha) {
    return res.status(400).json({ mensagem: 'Informe um e-mail e uma senha.' });
  }

  if (!senhaService.senhaForte(senha)) {
    return res.status(400).json({ mensagem: 'A senha precisa ter pelo menos 8 caracteres, uma letra maiúscula, um número e um caractere especial.' });
  }

  if (senha !== confirmarSenha) {
    return res.status(400).json({ mensagem: 'As senhas não são iguais.' });
  }

  if (aceitouTermos !== true) {
    return res.status(400).json({ mensagem: 'É necessário aceitar os Termos de Uso para criar a conta.' });
  }

  if (!PERFIS_CADASTRO.includes(perfil)) {
    return res.status(400).json({ mensagem: 'O cadastro cria apenas contas de aluno. O acesso de professor depende do administrador.' });
  }

  const turma = String(req.body.turma || '').trim();
  if (!ANOS_ENSINO_MEDIO.includes(turma)) {
    return res.status(400).json({ mensagem: 'Selecione o 1º, 2º ou 3º ano do ensino médio.' });
  }

  try {
    const usuario = await usuarioModel.criar({
      email: emailLimpo,
      senhaHash: await senhaService.gerarHash(senha),
      perfil,
      turma,
      versaoTermos: VERSAO_TERMOS
    });
    await registrarAuditoria(req, 'cadastro_criado', 'usuarios', { email: emailLimpo, perfil }, usuario);
    res.status(201).json({ mensagem: 'Conta criada. Agora você pode entrar.' });
  } catch (erro) {
    if (erro.code === '23505') {
      await registrarAuditoria(req, 'cadastro_recusado', 'usuarios', { email: emailLimpo, motivo: 'email_duplicado' });
      return res.status(409).json({ mensagem: 'Já existe uma conta com este e-mail.' });
    }
    console.error('Erro ao criar conta:', erro.message);
    res.status(503).json({ mensagem: 'Não foi possível acessar o banco de dados. Configure o arquivo .env e tente novamente.' });
  }
}

async function login(req, res) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const senha = String(req.body.senha || '');
    const usuario = await usuarioModel.buscarAtivoPorEmail(email);

    if (!usuario || !(await senhaService.conferir(senha, usuario.senha_hash))) {
      await registrarAuditoria(req, 'login_falhou', 'autenticacao', { email, motivo: 'credenciais_invalidas' });
      return res.status(401).json({ mensagem: 'E-mail ou senha inválidos.' });
    }

    const desafioExistente = await desafioMfaModel.buscarAtivoDoUsuario(usuario.id);
    if (desafioExistente) {
      return res.json(await mfaService.montarRespostaDesafio(usuario, desafioExistente));
    }

    const tipo = usuario.mfa_totp_ativo ? 'login' : 'configuracao';
    const segredoTemporario = tipo === 'configuracao' ? mfaService.novoSegredoCifrado() : null;
    const desafioId = await desafioMfaModel.criar(usuario.id, tipo, segredoTemporario);

    await registrarAuditoria(
      req,
      tipo === 'configuracao' ? 'totp_configuracao_iniciada' : 'totp_desafio_iniciado',
      'autenticacao',
      {},
      usuario
    );
    return res.json(await mfaService.montarRespostaDesafio(usuario, { id: desafioId, tipo, segredo_temporario: segredoTemporario }));
  } catch (erro) {
    console.error('Erro ao iniciar confirmação por aplicativo autenticador:', erro.message);
    res.status(503).json({ mensagem: 'Não foi possível iniciar a confirmação em duas etapas. Verifique a configuração do servidor e tente novamente.' });
  }
}

async function verificarTotp(req, res) {
  try {
    const desafioId = String(req.body.desafioId || '');
    const codigo = String(req.body.codigo || '').replace(/\D/g, '');
    if (!mfaService.idDesafioValido(desafioId) || !/^\d{6}$/.test(codigo)) {
      return res.status(400).json({ mensagem: 'Informe o código de 6 dígitos do aplicativo autenticador.' });
    }

    const usuario = await desafioMfaModel.buscarValidoComUsuario(desafioId);
    if (!usuario) {
      return res.status(401).json({ mensagem: 'Este código expirou ou atingiu o limite de tentativas. Entre novamente para solicitar outro.' });
    }

    await desafioMfaModel.incrementarTentativas(desafioId);
    const segredo = mfaService.decifrarSegredo(
      usuario.desafio_tipo === 'configuracao' ? usuario.segredo_temporario : usuario.mfa_totp_segredo
    );

    if (!(await mfaService.verificarCodigo(codigo, segredo))) {
      await registrarAuditoria(req, 'codigo_totp_recusado', 'autenticacao', {}, usuario);
      return res.status(401).json({ mensagem: 'Código inválido ou expirado. Confira o aplicativo autenticador e tente novamente.' });
    }

    if (!(await desafioMfaModel.consumir(desafioId))) {
      return res.status(401).json({ mensagem: 'Este código já foi utilizado. Entre novamente para solicitar outro.' });
    }

    if (usuario.desafio_tipo === 'configuracao') {
      await usuarioModel.ativarMfa(usuario.id, usuario.segredo_temporario);
      await registrarAuditoria(req, 'totp_configurado', 'autenticacao', {}, usuario);
    }

    const token = await sessaoModel.criar(usuario.id);
    gravarCookieSessao(res, token);
    await registrarAuditoria(req, 'login_realizado', 'autenticacao', {}, usuario);
    res.json({ usuario: usuarioModel.paraPublico(usuario), token });
  } catch (erro) {
    console.error('Erro ao confirmar código TOTP:', erro.message);
    res.status(503).json({ mensagem: 'Não foi possível confirmar o código. Tente novamente.' });
  }
}

async function solicitarRecuperacao(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ mensagem: 'Informe um e-mail válido.' });
  try {
    await recuperacaoSenhaService.solicitar(email);
    res.json({ mensagem: 'Se o e-mail estiver cadastrado e ativo, você receberá um código válido por 10 minutos. Confira o spam. Para reenviar, aguarde 1 minuto.' });
  } catch (erro) {
    console.error('Erro ao solicitar recuperação:', erro.code || 'serviço indisponível');
    res.status(503).json({ mensagem: 'Não foi possível solicitar a recuperação. Tente novamente.' });
  }
}
async function verificarCodigoRecuperacao(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();
  const codigo = String(req.body.codigo || '').trim();
  if (!email || email.length > 150 || !/^\d{6}$/.test(codigo)) return res.status(400).json({ mensagem: 'Informe o e-mail e o código de 6 dígitos.' });
  try {
    const token = await recuperacaoSenhaService.verificarCodigo(email, codigo);
    if (!token) return res.status(400).json({ mensagem: 'Código inválido, expirado ou com limite de tentativas atingido. Solicite outro código.' });
    res.set('Cache-Control', 'no-store');
    res.json({ token });
  } catch (erro) {
    console.error('Erro ao verificar recuperação:', erro.code || 'serviço indisponível');
    res.status(503).json({ mensagem: 'Não foi possível verificar o código. Tente novamente.' });
  }
}
async function recuperarSenha(req, res) {
  const token = String(req.body.token || '');
  const novaSenha = String(req.body.novaSenha || '');
  const confirmarSenha = String(req.body.confirmarSenha || '');
  if (!/^[a-f0-9]{64}$/.test(token)) return res.status(400).json({ mensagem: 'Valide o código recebido por e-mail antes de redefinir a senha.' });
  if (!senhaService.senhaForte(novaSenha) || Buffer.byteLength(novaSenha, 'utf8') > 72) return res.status(400).json({ mensagem: 'Use pelo menos 8 caracteres, uma letra maiúscula, um número e um caractere especial (máximo de 72 bytes).' });
  if (novaSenha !== confirmarSenha) return res.status(400).json({ mensagem: 'As senhas não são iguais.' });
  try {
    const usuario = await recuperacaoSenhaService.redefinir(token, novaSenha);
    if (!usuario) return res.status(400).json({ mensagem: 'Código inválido, expirado ou com limite de tentativas atingido. Solicite outro código.' });
    await registrarAuditoria(req, 'senha_redefinida', 'autenticacao', {}, usuario);
    limparCookieSessao(res);
    res.json({ mensagem: 'Senha atualizada. Entre com a nova senha e confirme pelo aplicativo autenticador.' });
  } catch (erro) {
    console.error('Erro ao redefinir senha:', erro.code || 'serviço indisponível');
    res.status(503).json({ mensagem: 'Não foi possível redefinir a senha. Tente novamente.' });
  }
}

async function encerrarConta(req, res) {
  if (req.usuario.perfil === 'admin') {
    return res.status(403).json({ mensagem: 'O administrador não pode excluir a própria conta.' });
  }
  const senha = String(req.body.senha || '');
  const hashSalvo = await usuarioModel.buscarSenhaHashAtivo(req.usuario.id);

  if (!hashSalvo || !(await senhaService.conferir(senha, hashSalvo))) {
    return res.status(401).json({ mensagem: 'Senha incorreta. A conta não foi encerrada.' });
  }

  try {
    await usuarioModel.encerrarConta(req.usuario, { metodo: req.method, rota: req.originalUrl });
  } catch (erro) {
    console.error('Erro ao encerrar conta:', erro.message);
    return res.status(503).json({ mensagem: 'Não foi possível encerrar a conta. Tente novamente.' });
  }
  limparCookieSessao(res);
  res.json({ mensagem: 'Conta encerrada. Suas perguntas permanecem no sistema com autoria anonimizada. Você será desconectado.' });
}

async function sair(req, res) {
  await sessaoModel.remover(extrairToken(req));
  limparCookieSessao(res);
  await registrarAuditoria(req, 'logout_realizado', 'autenticacao');
  res.status(204).end();
}

function eu(req, res) {
  res.json({ usuario: usuarioModel.paraPublico(req.usuario) });
}

module.exports = { cadastro, login, verificarTotp, solicitarRecuperacao, verificarCodigoRecuperacao, recuperarSenha, encerrarConta, sair, eu };
