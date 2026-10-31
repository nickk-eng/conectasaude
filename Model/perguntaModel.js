const banco = require('../Config/banco');

async function criar({ texto, alternativas, respostaCorreta, nivel, categoriaIst, autorId }) {
  const resultado = await banco.query(
    'INSERT INTO perguntas (texto, alternativas, resposta_correta, nivel, categoria_ist, autor_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    [texto, JSON.stringify(alternativas), respostaCorreta, nivel, categoriaIst, autorId]
  );
  return resultado.rows[0].id;
}

async function listarParaAdmin() {
  const dados = await banco.query(
    `SELECT p.id, p.texto, p.alternativas, p.resposta_correta, p.nivel, p.categoria_ist, p.status, p.criado_em,
            CASE WHEN u.id IS NULL OR u.ativo = FALSE THEN 'Autor anonimizado'
                 ELSE COALESCE(NULLIF(u.nome, ''), u.email) END AS nome,
            CASE WHEN u.ativo THEN u.email ELSE NULL END AS email
       FROM perguntas p LEFT JOIN usuarios u ON u.id = p.autor_id
      ORDER BY CASE p.status WHEN 'pendente' THEN 0 ELSE 1 END, p.criado_em DESC`
  );
  return dados.rows;
}


async function avaliar(id, status, avaliadorId) {
  const resultado = await banco.query(
    "UPDATE perguntas SET status = $1, avaliada_por = $2, avaliada_em = NOW() WHERE id = $3 AND status = 'pendente' RETURNING id",
    [status, avaliadorId, id]
  );
  return resultado.rowCount > 0;
}

async function criarComoAdmin({ texto, alternativas, respostaCorreta, nivel, categoriaIst, status, autorId }) {
  const dados = await banco.query(
    `INSERT INTO perguntas (texto, alternativas, resposta_correta, nivel, categoria_ist, status, autor_id, avaliada_por, avaliada_em)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7, CASE WHEN $6 = 'pendente' THEN NULL ELSE NOW() END) RETURNING id`,
    [texto, JSON.stringify(alternativas), respostaCorreta, nivel, categoriaIst, status, autorId]
  );
  return dados.rows[0].id;
}

async function atualizarComoAdmin(id, { texto, alternativas, respostaCorreta, nivel, categoriaIst, status }, avaliadorId) {
  const dados = await banco.query(
    `UPDATE perguntas SET texto = $1, alternativas = $2, resposta_correta = $3, nivel = $4,
       categoria_ist = $5, status = $6, avaliada_por = $7,
       avaliada_em = CASE WHEN $6 = 'pendente' THEN NULL ELSE NOW() END WHERE id = $8 RETURNING id`,
    [texto, JSON.stringify(alternativas), respostaCorreta, nivel, categoriaIst, status, avaliadorId, id]
  );
  return dados.rowCount > 0;
}

async function excluirComoAdmin(id) {
  const dados = await banco.query('DELETE FROM perguntas WHERE id = $1 RETURNING id', [id]);
  return dados.rowCount > 0;
}

async function sortearAprovadas(nivel, categoriaIst) {
  const filtros = ["status = 'aprovada'"];
  const parametros = [];
  if (nivel) { parametros.push(nivel); filtros.push(`nivel = $${parametros.length}`); }
  if (categoriaIst) { parametros.push(categoriaIst); filtros.push(`categoria_ist = $${parametros.length}`); }
  const consulta = `SELECT id, texto, alternativas, resposta_correta FROM perguntas WHERE ${filtros.join(' AND ')} ORDER BY RANDOM() LIMIT 20`;
  const dados = await banco.query(consulta, parametros);
  return dados.rows;
}

async function indicadoresPorCategoria() {
  const dados = await banco.query(
    `SELECT categoria_ist, COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'aprovada')::int AS aprovadas,
       COUNT(*) FILTER (WHERE status = 'pendente')::int AS pendentes,
       COUNT(*) FILTER (WHERE status = 'recusada')::int AS recusadas
     FROM perguntas GROUP BY categoria_ist`
  );
  return dados.rows;
}

async function reatribuirAutor(autorAntigoId, autorNovoId) {
  await banco.query('UPDATE perguntas SET autor_id = $1 WHERE autor_id = $2', [autorNovoId, autorAntigoId]);
}

async function sortearIdsAprovadas(limite) {
  const dados = await banco.query(
    "SELECT id FROM perguntas WHERE status = 'aprovada' ORDER BY RANDOM() LIMIT $1",
    [limite]
  );
  return dados.rows.map((linha) => linha.id);
}

// O tipo do id (UUID ou inteiro) depende de como a tabela foi criada, então compara como texto.
async function buscarPorIds(ids) {
  const dados = await banco.query(
    'SELECT id, texto, alternativas, resposta_correta FROM perguntas WHERE id::text = ANY($1::text[])',
    [ids.map(String)]
  );
  return dados.rows;
}

function alternativasDe(pergunta) {
  return typeof pergunta.alternativas === 'string' ? JSON.parse(pergunta.alternativas) : pergunta.alternativas;
}

module.exports = { criar, listarParaAdmin, avaliar, criarComoAdmin, atualizarComoAdmin, excluirComoAdmin, sortearAprovadas, indicadoresPorCategoria, reatribuirAutor, sortearIdsAprovadas, buscarPorIds, alternativasDe };
