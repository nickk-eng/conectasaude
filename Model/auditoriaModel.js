const banco = require('../Config/banco');

async function registrar(d) {
  await banco.query(
    `INSERT INTO auditoria_acessos
      (usuario_id, usuario_email, perfil, acao, recurso, detalhes, metodo, rota, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [d.usuarioId, d.usuarioEmail, d.perfil, d.acao, d.recurso, JSON.stringify(d.detalhes || {}), d.metodo, d.rota, d.ip, d.userAgent]
  );
}

async function listar(limite) {
  const dados = await banco.query(
    `SELECT id, usuario_id, usuario_email, perfil, acao, recurso, detalhes, metodo, rota, ip, user_agent, criado_em
       FROM auditoria_acessos
      ORDER BY criado_em DESC
      LIMIT $1`,
    [limite]
  );
  return dados.rows;
}

async function historicoAluno(usuarioId, pagina = 1) {
  const [totais, dados] = await Promise.all([
    banco.query('SELECT COUNT(*)::int AS total_partidas, COALESCE(SUM(acertos), 0)::int AS acertos, COALESCE(SUM(erros), 0)::int AS erros FROM partidas WHERE usuario_id = $1', [usuarioId]),
    banco.query('SELECT id, acertos, erros, nivel, modo, resultado, criada_em FROM partidas WHERE usuario_id = $1 ORDER BY criada_em DESC, id DESC LIMIT 20 OFFSET $2', [usuarioId, (pagina - 1) * 20])
  ]);
  const resumo = totais.rows[0];
  return {
    pagina,
    totalPartidas: Number(resumo.total_partidas || 0),
    acertos: Number(resumo.acertos || 0),
    erros: Number(resumo.erros || 0),
    partidas: dados.rows.map(({ id, acertos, erros, nivel, modo, resultado, criada_em }) => ({ id, data: criada_em, nivel, modo, resultado, acertos, erros }))
  };
}

async function relatorioProfessor({ turma = '', de = null, ate = null } = {}) {
  const dados = await banco.query(
    `SELECT u.id, u.nome, u.email, u.turma, COUNT(p.id)::int AS partidas,
            COALESCE(SUM(p.acertos), 0)::int AS acertos,
            COALESCE(SUM(p.erros), 0)::int AS erros,
            MAX(p.criada_em) AS ultima_partida
       FROM usuarios u
       LEFT JOIN partidas p ON p.usuario_id = u.id
        AND ($2::date IS NULL OR p.criada_em >= $2::date)
        AND ($3::date IS NULL OR p.criada_em < ($3::date + INTERVAL '1 day'))
      WHERE u.perfil = 'aluno' AND u.ativo = TRUE AND ($1 = '' OR u.turma ILIKE '%' || $1 || '%')
      GROUP BY u.id, u.nome, u.email, u.turma ORDER BY u.turma, u.nome, u.email`,
    [turma, de, ate]
  );
  return dados.rows.map((aluno) => ({
    ...aluno,
    taxaAcerto: Number(aluno.acertos) + Number(aluno.erros)
      ? Math.round(Number(aluno.acertos) / (Number(aluno.acertos) + Number(aluno.erros)) * 100)
      : 0
  }));
}

module.exports = { registrar, listar, historicoAluno, relatorioProfessor };
