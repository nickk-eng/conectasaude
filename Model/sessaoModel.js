const banco = require('../Config/banco');

async function criar(usuarioId) {
  const sessao = await banco.query(
    `INSERT INTO sessoes (id, usuario_id, expira_em)
     VALUES (gen_random_uuid(), $1, NOW() + INTERVAL '8 hours')
     RETURNING id`,
    [usuarioId]
  );
  return sessao.rows[0].id;
}

async function buscarUsuarioPorToken(token) {
  const resultado = await banco.query(
    `SELECT u.id, u.email, u.nome, u.perfil, u.turma
       FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.id = $1 AND s.expira_em > NOW()`,
    [token]
  );
  return resultado.rows[0] || null;
}

async function remover(token) {
  await banco.query('DELETE FROM sessoes WHERE id = $1', [token]);
}

async function removerDoUsuario(usuarioId) {
  await banco.query('DELETE FROM sessoes WHERE usuario_id = $1', [usuarioId]);
}

module.exports = { criar, buscarUsuarioPorToken, remover, removerDoUsuario };
