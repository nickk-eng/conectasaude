const banco = require("../Config/banco");
const { ANOS_ENSINO_MEDIO } = require("../Config/constantes");
const { aguardaAprovacao } = require("../Service/acessoService");
const emailUtil = require("../Utils/mascararEmail");

const COLUNAS_PUBLICAS =
  "id, email, nome, perfil, turma, responsaveis_nome, solicitou_professor, status_professor";

function paraPublico(usuario) {
  return {
    id: usuario.id,
    email: emailUtil.mascararEmail(usuario.email),
    nome: usuario.nome,
    perfil: usuario.perfil,
    turma: usuario.turma,
    responsaveisNome: usuario.responsaveis_nome || "",
    solicitouProfessor: usuario.solicitou_professor === true,
    statusProfessor: usuario.status_professor || "nao_aplicavel",
    aguardandoAprovacao: aguardaAprovacao(usuario),
  };
}

async function paraProprio(usuario, idAutenticado) {
  if (!usuario || usuario.id !== idAutenticado)
    throw new Error("Acesso negado aos dados de outro titular.");
  return {
    ...paraPublico(usuario),
    email: await buscarEmailCompletoProprio(idAutenticado, usuario.id),
  };
}

async function criar({ email, senhaHash, perfil, versaoTermos, turma = "" }) {
  const emailNormalizado = String(email).trim().toLowerCase();
  const resultado = await banco.query(
    `INSERT INTO usuarios (email, email_hash, email_criptografado, senha_hash, perfil, termos_aceitos_em, termos_versao, turma, status_professor)
     VALUES ($1, $2, $3, $4, 'aluno', NOW(), $5, $6, $7)
     RETURNING ${COLUNAS_PUBLICAS}`,
    [
      emailUtil.mascararEmail(emailNormalizado),
      emailUtil.gerarHashEmail(emailNormalizado),
      emailUtil.criptografarEmail(emailNormalizado),
      senhaHash,
      versaoTermos,
      perfil === "professor" ? "" : turma,
      perfil === "professor" ? "nao_solicitado" : "nao_aplicavel",
    ],
  );
  return resultado.rows[0];
}

async function buscarAtivoPorEmail(email) {
  const resultado = await banco.query(
    "SELECT * FROM usuarios WHERE email_hash = $1 AND ativo = TRUE",
    [emailUtil.gerarHashEmail(email)],
  );
  return resultado.rows[0] || null;
}

async function buscarSenhaHashAtivo(id) {
  const resultado = await banco.query(
    "SELECT senha_hash FROM usuarios WHERE id = $1 AND ativo = TRUE",
    [id],
  );
  return resultado.rows[0]?.senha_hash || null;
}

async function atualizarSenhaPorEmail(email, senhaHash) {
  const resultado = await banco.query(
    "UPDATE usuarios SET senha_hash = $1 WHERE email_hash = $2 AND ativo = TRUE RETURNING id, email, perfil",
    [senhaHash, emailUtil.gerarHashEmail(email)],
  );
  return resultado.rows[0] || null;
}

async function atualizarPerfil(id, nome, turma) {
  const resultado = await banco.query(
    `UPDATE usuarios SET nome = $1, turma = $2 WHERE id = $3 AND ativo = TRUE
       AND (perfil <> 'aluno' OR turma = $2 OR NOT (COALESCE(turma, '') = ANY($4::text[])))
     RETURNING ${COLUNAS_PUBLICAS}`,
    [nome, turma, id, ANOS_ENSINO_MEDIO],
  );
  return resultado.rows[0];
}

async function listarAlunos(professorId = null) {
  const dados = await banco.query(
    `SELECT ${COLUNAS_PUBLICAS} FROM usuarios WHERE perfil = 'aluno' AND ativo = TRUE AND status_professor = 'nao_aplicavel'
       AND ($1::uuid IS NULL OR EXISTS (SELECT 1 FROM alunos_dos_professores pa WHERE pa.professor_id = $1 AND pa.aluno_id = usuarios.id))
     ORDER BY nome, email`,
    [professorId],
  );
  return dados.rows;
}

async function listarParaAdmin() {
  const dados = await banco.query(
    `SELECT id, email, nome, perfil, turma, ativo, criado_em, solicitou_professor, status_professor FROM usuarios
      ORDER BY CASE perfil WHEN 'admin' THEN 0 WHEN 'professor' THEN 1 ELSE 2 END, nome, email`,
  );
  return dados.rows;
}

async function definirAtivo(id, ativo) {
  const dados = await banco.query(
    "UPDATE usuarios SET ativo = $1, encerrada_em = CASE WHEN $1 THEN NULL ELSE NOW() END WHERE id = $2 RETURNING id, email, nome, perfil, turma, ativo",
    [ativo, id],
  );
  return dados.rows[0] || null;
}

async function solicitarProfessor(id) {
  const dados = await banco.query(
    `UPDATE usuarios SET solicitou_professor = TRUE, status_professor = 'pendente'
     WHERE id = $1 AND ativo = TRUE AND perfil = 'aluno' AND status_professor = 'nao_solicitado'
     RETURNING ${COLUNAS_PUBLICAS}`,
    [id],
  );
  return dados.rows[0] || null;
}

async function decidirProfessor(id, decisao) {
  const perfil = decisao === "aprovar" ? "professor" : "aluno";
  const dados = await banco.query(
    `UPDATE usuarios SET perfil = $2, solicitou_professor = FALSE,
        status_professor = CASE $3 WHEN 'aprovar' THEN 'aprovado' WHEN 'recusar' THEN 'recusado' ELSE 'revogado' END,
        turma = CASE WHEN $3 = 'aprovar' THEN '' ELSE turma END
     WHERE id = $1 AND ativo = TRUE
       AND (($3 = 'revogar' AND perfil = 'professor')
         OR ($3 = 'aprovar' AND perfil = 'aluno' AND status_professor IN ('pendente', 'recusado', 'revogado'))
         OR ($3 = 'recusar' AND perfil = 'aluno' AND status_professor = 'pendente' AND solicitou_professor = TRUE))
     RETURNING ${COLUNAS_PUBLICAS}`,
    [id, perfil, decisao],
  );
  return dados.rows[0] || null;
}

async function buscarAtivoPorId(id) {
  const resultado = await banco.query(
    `SELECT ${COLUNAS_PUBLICAS} FROM usuarios WHERE id = $1 AND ativo = TRUE`,
    [id],
  );
  return resultado.rows[0] || null;
}

async function atualizarResponsaveisAluno(id, nomes, professorId = null) {
  const resultado = await banco.query(
    `UPDATE usuarios SET responsaveis_nome = $1
     WHERE id = $2 AND perfil = 'aluno' AND ativo = TRUE AND status_professor = 'nao_aplicavel'
       AND ($3::uuid IS NULL OR EXISTS (SELECT 1 FROM alunos_dos_professores pa WHERE pa.professor_id = $3 AND pa.aluno_id = usuarios.id))
     RETURNING id, responsaveis_nome`,
    [nomes, id, professorId],
  );
  return resultado.rows[0] || null;
}

async function ativarMfa(id, segredoCifrado) {
  await banco.query(
    "UPDATE usuarios SET mfa_totp_segredo = $1, mfa_totp_ativo = TRUE WHERE id = $2",
    [segredoCifrado, id],
  );
}

async function buscarIdAtivoPorEmail(email) {
  const resultado = await banco.query(
    "SELECT id FROM usuarios WHERE email_hash = $1 AND ativo = TRUE",
    [emailUtil.gerarHashEmail(email)],
  );
  return resultado.rows[0]?.id || null;
}

async function criarAdmin(email, senhaHash) {
  const normalizado = String(email).trim().toLowerCase();
  const resultado = await banco.query(
    `INSERT INTO usuarios (email, email_hash, email_criptografado, senha_hash, perfil, nome)
     VALUES ($1, $2, $3, $4, 'admin', 'Administrador')
     ON CONFLICT (email_hash) WHERE email_hash IS NOT NULL DO NOTHING
     RETURNING id`,
    [emailUtil.mascararEmail(normalizado), emailUtil.gerarHashEmail(normalizado), emailUtil.criptografarEmail(normalizado), senhaHash],
  );
  return resultado.rows[0]?.id || null;
}

async function alterarEmailAdmin(emailAnterior, emailNovo) {
  const anterior = String(emailAnterior).trim().toLowerCase();
  const novo = String(emailNovo).trim().toLowerCase();
  const resultado = await banco.query(
    `UPDATE usuarios SET email = $1, email_hash = $2, email_criptografado = $3
     WHERE email_hash = $4 AND perfil = 'admin' AND ativo = TRUE
     RETURNING id`,
    [emailUtil.mascararEmail(novo), emailUtil.gerarHashEmail(novo), emailUtil.criptografarEmail(novo), emailUtil.gerarHashEmail(anterior)],
  );
  return resultado.rows[0]?.id || null;
}

async function buscarEmailCompletoProprio(idAutenticado, usuarioId) {
  if (!idAutenticado || idAutenticado !== usuarioId) return null;
  const resultado = await banco.query(
    "SELECT email_criptografado FROM usuarios WHERE id = $1 AND ativo = TRUE",
    [usuarioId],
  );
  const cifrado = resultado.rows[0]?.email_criptografado;
  return cifrado ? emailUtil.descriptografarEmail(cifrado) : null;
}

async function buscarParaRevelacao(id) {
  const resultado = await banco.query(
    "SELECT id, nome, email, email_criptografado FROM usuarios WHERE id = $1",
    [id],
  );
  return resultado.rows[0] || null;
}

async function excluir(id) {
  await banco.query("DELETE FROM usuarios WHERE id = $1", [id]);
}

async function eliminarDadosConta(
  cliente,
  usuarioId,
  { solicitacaoPreservada = null } = {},
) {
  const atual = await cliente.query(
    "SELECT id, email, perfil FROM usuarios WHERE id = $1 FOR UPDATE",
    [usuarioId],
  );
  const usuario = atual.rows[0];
  if (!usuario)
    throw Object.assign(new Error("Conta não encontrada."), { status: 404 });
  if (usuario.perfil === "admin")
    throw Object.assign(
      new Error(
        "Contas administrativas não podem ser eliminadas por este fluxo.",
      ),
      { status: 403 },
    );

  await cliente.query(
    "UPDATE perguntas SET autor_id = NULL WHERE autor_id = $1",
    [usuarioId],
  );
  await cliente.query(
    "UPDATE perguntas SET avaliada_por = NULL WHERE avaliada_por = $1",
    [usuarioId],
  );
  await cliente.query(
    "DELETE FROM auditoria_acessos WHERE usuario_id = $1 OR usuario_email = $2 OR detalhes::text LIKE $3",
    [usuarioId, usuario.email, "%" + usuarioId + "%"],
  );
  await cliente.query(
    "DELETE FROM solicitacoes_privacidade WHERE usuario_id = $1 AND ($2::bigint IS NULL OR id <> $2)",
    [usuarioId, solicitacaoPreservada],
  );
  if (solicitacaoPreservada) {
    await cliente.query(
      "UPDATE solicitacoes_privacidade SET usuario_id = NULL, mensagem = '', resposta = '', providencia = '', comprovante = '' WHERE id = $1 AND usuario_id = $2",
      [solicitacaoPreservada, usuarioId],
    );
  }
  await cliente.query(
    "UPDATE solicitacoes_privacidade SET respondida_por = NULL WHERE respondida_por = $1",
    [usuarioId],
  );
  await cliente.query("DELETE FROM turmas WHERE professor_id = $1", [
    usuarioId,
  ]);
  await cliente.query("DELETE FROM escolas WHERE professor_id = $1", [
    usuarioId,
  ]);
  await cliente.query("DELETE FROM usuarios WHERE id = $1", [usuarioId]);
}

async function encerrarConta(usuario, { metodo, rota }) {
  const cliente = await banco.connect();
  try {
    await cliente.query("BEGIN");
    await eliminarDadosConta(cliente, usuario.id);
    await cliente.query(
      `INSERT INTO auditoria_acessos
        (usuario_id, usuario_email, perfil, acao, recurso, detalhes, metodo, rota, ip, user_agent)
       VALUES (NULL, NULL, NULL, 'conta_encerrada', 'usuarios', $1, $2, $3, NULL, NULL)`,
      [
        JSON.stringify({ perguntas_preservadas_com_autoria_anonimizada: true }),
        metodo,
        rota,
      ],
    );
    await cliente.query("COMMIT");
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
}

module.exports = {
  buscarAtivoPorId,
  solicitarProfessor,
  decidirProfessor,
  paraPublico,
  paraProprio,
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
  alterarEmailAdmin,
  buscarEmailCompletoProprio,
  buscarParaRevelacao,
  excluir,
  eliminarDadosConta,
  encerrarConta,
};
