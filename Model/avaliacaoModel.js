const banco = require('../Config/banco');

async function buscar(usuarioId, tipo) {
  const resultado = await banco.query(
    `SELECT id, tipo, perguntas, respostas, acertos, total, criada_em, concluida_em
       FROM avaliacoes
      WHERE usuario_id = $1 AND tipo = $2`,
    [usuarioId, tipo]
  );
  return resultado.rows[0] || null;
}

async function criar({ usuarioId, tipo, perguntas }) {
  const insercao = await banco.query(
    `INSERT INTO avaliacoes (usuario_id, tipo, perguntas, total)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (usuario_id, tipo) DO NOTHING
     RETURNING id`,
    [usuarioId, tipo, JSON.stringify(perguntas), perguntas.length]
  );
  return { criada: insercao.rowCount > 0, avaliacao: await buscar(usuarioId, tipo) };
}

async function concluir(id, respostas, acertos) {
  const resultado = await banco.query(
    `UPDATE avaliacoes
        SET respostas = $1, acertos = $2, concluida_em = NOW()
      WHERE id = $3 AND concluida_em IS NULL
      RETURNING id`,
    [JSON.stringify(respostas), acertos, id]
  );
  return resultado.rowCount > 0;
}

async function resumoPorAluno() {
  const dados = await banco.query(
    `SELECT u.id, u.nome, u.email, u.turma,
            pre.acertos AS pre_acertos, pre.total AS pre_total,
            pos.acertos AS pos_acertos, pos.total AS pos_total
       FROM usuarios u
       LEFT JOIN avaliacoes pre ON pre.usuario_id = u.id AND pre.tipo = 'pre' AND pre.concluida_em IS NOT NULL
       LEFT JOIN avaliacoes pos ON pos.usuario_id = u.id AND pos.tipo = 'pos' AND pos.concluida_em IS NOT NULL
      WHERE u.perfil = 'aluno' AND u.ativo = TRUE
      ORDER BY u.nome, u.email`
  );
  return dados.rows;
}

module.exports = { buscar, criar, concluir, resumoPorAluno };
