const banco = require('../Config/banco');

async function criar({ usuarioId, tipo, mensagem }) {
  const resultado = await banco.query(
    'INSERT INTO solicitacoes_privacidade (usuario_id, tipo, mensagem) VALUES ($1, $2, $3) RETURNING id',
    [usuarioId, tipo, mensagem]
  );
  return resultado.rows[0].id;
}

async function listar() {
  const dados = await banco.query(
    `SELECT s.id, s.tipo, s.mensagem, s.status, s.criado_em,
            CASE WHEN u.id IS NULL OR u.ativo = FALSE THEN 'Conta anonimizada'
                 ELSE COALESCE(NULLIF(u.nome, ''), u.email) END AS solicitante
       FROM solicitacoes_privacidade s
       LEFT JOIN usuarios u ON u.id = s.usuario_id
      ORDER BY s.criado_em DESC
      LIMIT 100`
  );
  return dados.rows;
}

module.exports = { criar, listar };
