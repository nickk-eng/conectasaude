const { ANOS_ENSINO_MEDIO } = require('../Config/constantes');
const banco = require('../Config/banco');

const COLUNAS_PUBLICAS = 'id, email, nome, perfil, turma, responsaveis_nome';

function paraPublico(usuario) {
  return {
    id: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    perfil: usuario.perfil,
    turma: usuario.turma,
    responsaveisNome: usuario.responsaveis_nome || ''
  };
}

async function criar({ email, senhaHash, perfil, versaoTermos, turma = '' }) {
  const resultado = await banco.query(
    `INSERT INTO usuarios (email, senha_hash, perfil, termos_aceitos_em, termos_versao, turma)
     VALUES ($1, $2, $3, NOW(), $4, $5)
     RETURNING ${COLUNAS_PUBLICAS}`,
    [email, senhaHash, perfil, versaoTermos, turma]
  );
  return resultado.rows[0];
}

async function buscarAtivoPorEmail(email) {
  const resultado = await banco.query('SELECT * FROM usuarios WHERE email = $1 AND ativo = TRUE', [email]);
  return resultado.rows[0] || null;
}

async function buscarSenhaHashAtivo(id) {
  const resultado = await banco.query('SELECT senha_hash FROM usuarios WHERE id = $1 AND ativo = TRUE', [id]);
  return resultado.rows[0]?.senha_hash || null;
}

async function atualizarSenhaPorEmail(email, senhaHash) {
  const resultado = await banco.query(
    'UPDATE usuarios SET senha_hash = $1 WHERE email = $2 AND ativo = TRUE RETURNING id, email, perfil',
    [senhaHash, email]
  );
  return resultado.rows[0] || null;
}

async function atualizarPerfil(id, nome, turma) {
  const resultado = await banco.query(
    `UPDATE usuarios SET nome = $1, turma = $2 WHERE id = $3
       AND (perfil <> 'aluno' OR turma = $2 OR NOT (COALESCE(turma, '') = ANY($4::text[])))
     RETURNING ${COLUNAS_PUBLICAS}`,
    [nome, turma, id, ANOS_ENSINO_MEDIO]
  );
  return resultado.rows[0];
}

async function listarAlunos() {
  const dados = await banco.query(
    `SELECT ${COLUNAS_PUBLICAS} FROM usuarios WHERE perfil = 'aluno' AND ativo = TRUE ORDER BY nome, email`
  );
  return dados.rows;
}

async function listarParaAdmin() {
  const dados = await banco.query(
    `SELECT id, email, nome, perfil, turma, ativo, criado_em FROM usuarios
      ORDER BY CASE perfil WHEN 'admin' THEN 0 WHEN 'professor' THEN 1 ELSE 2 END, nome, email`
  );
  return dados.rows;
}

async function definirAtivo(id, ativo) {
  const dados = await banco.query(
    'UPDATE usuarios SET ativo = $1, encerrada_em = CASE WHEN $1 THEN NULL ELSE NOW() END WHERE id = $2 RETURNING id, email, nome, perfil, turma, ativo',
    [ativo, id]
  );
  return dados.rows[0] || null;
}

async function atualizarResponsaveisAluno(id, nomes) {
  const resultado = await banco.query(
    `UPDATE usuarios SET responsaveis_nome = $1
     WHERE id = $2 AND perfil = 'aluno' AND ativo = TRUE
     RETURNING id, responsaveis_nome`,
    [nomes, id]
  );
  return resultado.rows[0] || null;
}

async function ativarMfa(id, segredoCifrado) {
  await banco.query('UPDATE usuarios SET mfa_totp_segredo = $1, mfa_totp_ativo = TRUE WHERE id = $2', [segredoCifrado, id]);
}

async function buscarIdAtivoPorEmail(email) {
  const resultado = await banco.query('SELECT id FROM usuarios WHERE email = $1 AND ativo = TRUE', [email]);
  return resultado.rows[0]?.id || null;
}

async function criarAdmin(email, senhaHash) {
  const resultado = await banco.query(
    "INSERT INTO usuarios (email, senha_hash, perfil, nome) VALUES ($1, $2, 'admin', 'Administrador') RETURNING id",
    [email, senhaHash]
  );
  return resultado.rows[0].id;
}

async function excluir(id) {
  await banco.query('DELETE FROM usuarios WHERE id = $1', [id]);
}

async function encerrarConta(usuario, { metodo, rota }) {
  const cliente = await banco.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('UPDATE perguntas SET autor_id = NULL WHERE autor_id = $1', [usuario.id]);
    await cliente.query(
      `UPDATE auditoria_acessos
       SET usuario_id = NULL, usuario_email = NULL, perfil = NULL, ip = NULL, user_agent = NULL,
           detalhes = detalhes - 'email'
       WHERE usuario_id = $1 OR usuario_email = $2`,
      [usuario.id, usuario.email]
    );
    await cliente.query(
      `UPDATE usuarios
       SET ativo = FALSE, encerrada_em = NOW(), senha_hash = '',
           email = 'anonimizado+' || id::text || '@invalid.local',
           nome = 'Autor anonimizado', turma = '', responsaveis_nome = '', mfa_totp_segredo = NULL, mfa_totp_ativo = FALSE,
           termos_aceitos_em = NULL, termos_versao = NULL
       WHERE id = $1 AND ativo = TRUE`,
      [usuario.id]
    );
    await cliente.query('DELETE FROM sessoes WHERE usuario_id = $1', [usuario.id]);
    await cliente.query(
      `INSERT INTO auditoria_acessos
        (usuario_id, usuario_email, perfil, acao, recurso, detalhes, metodo, rota, ip, user_agent)
       VALUES (NULL, NULL, NULL, 'conta_encerrada', 'usuarios', $1, $2, $3, NULL, NULL)`,
      [JSON.stringify({ perguntas_preservadas_com_autoria_anonimizada: true }), metodo, rota]
    );
    await cliente.query('COMMIT');
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

module.exports = {
  paraPublico,
  criar,
  buscarAtivoPorEmail,
  buscarSenhaHashAtivo,
  atualizarSenhaPorEmail,
  atualizarPerfil,
  listarAlunos,
  listarParaAdmin,
  definirAtivo,
  atualizarResponsaveisAluno,
  ativarMfa,
  buscarIdAtivoPorEmail,
  criarAdmin,
  excluir,
  encerrarConta
};
