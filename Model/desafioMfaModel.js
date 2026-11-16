const banco = require("../Config/banco");
const {
  MAX_TENTATIVAS_MFA,
  DURACAO_DESAFIO_MFA,
} = require("../Config/constantes");

async function buscarAtivoDoUsuario(usuarioId) {
  const resultado = await banco.query(
    `SELECT id, tipo, segredo_temporario, expira_em, tentativas
     FROM desafios_mfa
     WHERE usuario_id = $1 AND tipo <> 'email' AND expira_em > NOW() AND tentativas < $2
     ORDER BY criado_em DESC
     LIMIT 1`,
    [usuarioId, MAX_TENTATIVAS_MFA],
  );
  return resultado.rows[0] || null;
}

async function criar(usuarioId, tipo, segredoTemporario) {
  const resultado = await banco.query(
    `INSERT INTO desafios_mfa (usuario_id, tipo, segredo_temporario, expira_em)
     VALUES ($1, $2, $3, NOW() + INTERVAL '${DURACAO_DESAFIO_MFA}')
     RETURNING id`,
    [usuarioId, tipo, segredoTemporario],
  );
  return resultado.rows[0].id;
}

async function buscarValidoComUsuario(desafioId) {
  const resultado = await banco.query(
    `SELECT d.id AS desafio_id, d.tipo AS desafio_tipo, d.segredo_temporario, d.codigo_hash, d.tentativas, u.*
       FROM desafios_mfa d JOIN usuarios u ON u.id = d.usuario_id
      WHERE d.id = $1 AND d.expira_em > NOW() AND d.tentativas < $2 AND u.ativo = TRUE`,
    [desafioId, MAX_TENTATIVAS_MFA],
  );
  return resultado.rows[0] || null;
}

async function incrementarTentativas(desafioId) {
  const resultado = await banco.query(
    "UPDATE desafios_mfa SET tentativas = tentativas + 1 WHERE id = $1 AND tentativas < $2 AND expira_em > NOW() RETURNING id",
    [desafioId, MAX_TENTATIVAS_MFA],
  );
  return resultado.rowCount > 0;
}

async function consumir(desafioId) {
  const resultado = await banco.query(
    "DELETE FROM desafios_mfa WHERE id = $1 AND expira_em > NOW() RETURNING id",
    [desafioId],
  );
  return resultado.rowCount > 0;
}

async function criarEmail(usuarioId, id, codigoHash, enviar) {
  const cliente = await banco.connect();
  try {
    await cliente.query("BEGIN");
    await cliente.query("SELECT id FROM usuarios WHERE id = $1 FOR UPDATE", [
      usuarioId,
    ]);
    const recente = await cliente.query(
      "SELECT id, tipo FROM desafios_mfa WHERE usuario_id = $1 AND tipo = 'email' AND criado_em > NOW() - INTERVAL '1 minute' ORDER BY criado_em DESC LIMIT 1",
      [usuarioId],
    );
    if (recente.rows[0]) {
      await cliente.query("COMMIT");
      return recente.rows[0];
    }
    await cliente.query(
      "DELETE FROM desafios_mfa WHERE usuario_id = $1 AND tipo = 'email'",
      [usuarioId],
    );
    await cliente.query(
      "INSERT INTO desafios_mfa (id, usuario_id, tipo, codigo_hash, expira_em) VALUES ($1, $2, 'email', $3, NOW() + INTERVAL '10 minutes')",
      [id, usuarioId, codigoHash],
    );
    await enviar();
    await cliente.query("COMMIT");
    return { id, tipo: "email" };
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
}

module.exports = {
  criarEmail,
  buscarAtivoDoUsuario,
  criar,
  buscarValidoComUsuario,
  incrementarTentativas,
  consumir,
};
