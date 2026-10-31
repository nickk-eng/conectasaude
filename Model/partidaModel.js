const banco = require('../Config/banco');

async function registrar({ usuarioId, acertos, erros, nivel, modo, resultado }) {
  await banco.query(
    `INSERT INTO partidas (usuario_id, acertos, erros, nivel, modo, resultado)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [usuarioId, acertos, erros, nivel, modo, resultado]
  );
}

async function contarDepoisDoPreTeste(usuarioId) {
  const resultado = await banco.query(
    `SELECT COUNT(*)::int AS total
       FROM partidas p
       JOIN avaliacoes a ON a.usuario_id = p.usuario_id AND a.tipo = 'pre'
      WHERE p.usuario_id = $1 AND a.concluida_em IS NOT NULL AND p.criada_em > a.concluida_em`,
    [usuarioId]
  );
  return resultado.rows[0].total;
}

module.exports = { registrar, contarDepoisDoPreTeste };
