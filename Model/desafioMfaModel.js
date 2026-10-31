const banco = require('../Config/banco');
const { MAX_TENTATIVAS_MFA, DURACAO_DESAFIO_MFA } = require('../Config/constantes');

async function buscarAtivoDoUsuario(usuarioId) {
  const resultado = await banco.query(
    `SELECT id, tipo, segredo_temporario, expira_em, tentativas
     FROM desafios_mfa
     WHERE usuario_id = $1 AND expira_em > NOW() AND tentativas < $2
     ORDER BY criado_em DESC
     LIMIT 1`,
    [usuarioId, MAX_TENTATIVAS_MFA]
  );
  return resultado.rows[0] || null;
}

async function criar(usuarioId, tipo, segredoTemporario) {
  const resultado = await banco.query(
    `INSERT INTO desafios_mfa (usuario_id, tipo, segredo_temporario, expira_em)
     VALUES ($1, $2, $3, NOW() + INTERVAL '${DURACAO_DESAFIO_MFA}')
     RETURNING id`,
    [usuarioId, tipo, segredoTemporario]
  );
  return resultado.rows[0].id;
}

// Devolve o desafio válido junto com os dados do usuário (colunas de u.* + desafio_*).
async function buscarValidoComUsuario(desafioId) {
  const resultado = await banco.query(
    `SELECT d.id AS desafio_id, d.tipo AS desafio_tipo, d.segredo_temporario, d.tentativas, u.*
       FROM desafios_mfa d JOIN usuarios u ON u.id = d.usuario_id
      WHERE d.id = $1 AND d.expira_em > NOW() AND d.tentativas < $2 AND u.ativo = TRUE`,
    [desafioId, MAX_TENTATIVAS_MFA]
  );
  return resultado.rows[0] || null;
}

async function incrementarTentativas(desafioId) {
  await banco.query('UPDATE desafios_mfa SET tentativas = tentativas + 1 WHERE id = $1', [desafioId]);
}

// Retorna true se este chamador foi quem consumiu o desafio (evita reuso).
async function consumir(desafioId) {
  const resultado = await banco.query('DELETE FROM desafios_mfa WHERE id = $1 RETURNING id', [desafioId]);
  return resultado.rowCount > 0;
}

module.exports = { buscarAtivoDoUsuario, criar, buscarValidoComUsuario, incrementarTentativas, consumir };
