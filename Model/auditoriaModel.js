const banco = require("../Config/banco");

async function registrar(d) {
  await banco.query(
    `INSERT INTO auditoria_acessos
      (usuario_id, usuario_email, perfil, acao, recurso, detalhes, metodo, rota, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      d.usuarioId,
      d.usuarioEmail,
      d.perfil,
      d.acao,
      d.recurso,
      JSON.stringify(d.detalhes || {}),
      d.metodo,
      d.rota,
      d.ip,
      d.userAgent,
    ],
  );
}

async function listar(limite, antes = null) {
  const dados = await banco.query(
    `SELECT id, usuario_id, usuario_email, perfil, acao, recurso, detalhes, metodo, rota, ip, user_agent, criado_em
       FROM auditoria_acessos
      WHERE ($2::bigint IS NULL OR id < $2::bigint)
      ORDER BY id DESC
      LIMIT $1`,
    [limite, antes],
  );
  return dados.rows;
}

async function historicoAluno(usuarioId, pagina = 1) {
  const [totais, dados] = await Promise.all([
    banco.query(
      "SELECT COUNT(*)::int AS total_partidas, COALESCE(SUM(acertos), 0)::int AS acertos, COALESCE(SUM(erros), 0)::int AS erros FROM partidas WHERE usuario_id = $1",
      [usuarioId],
    ),
    banco.query(
      "SELECT id, acertos, erros, nivel, modo, resultado, criada_em FROM partidas WHERE usuario_id = $1 ORDER BY criada_em DESC, id DESC LIMIT 20 OFFSET $2",
      [usuarioId, (pagina - 1) * 20],
    ),
  ]);
  const resumo = totais.rows[0];
  return {
    pagina,
    totalPartidas: Number(resumo.total_partidas || 0),
    acertos: Number(resumo.acertos || 0),
    erros: Number(resumo.erros || 0),
    partidas: dados.rows.map(
      ({ id, acertos, erros, nivel, modo, resultado, criada_em }) => ({
        id,
        data: criada_em,
        nivel,
        modo,
        resultado,
        acertos,
        erros,
      }),
    ),
  };
}

async function relatorioProfessor({
  turma = "",
  de = null,
  ate = null,
  professorId = null,
  escolaId = null,
  ano = null,
  letra = "",
} = {}) {
  const dados = await banco.query(
    `WITH vinculos AS (
       SELECT ta.aluno_id,
              string_agg(DISTINCT e.nome, ' · ' ORDER BY e.nome) AS escolas,
              string_agg(DISTINCT t.ano::text || t.letra, ', ' ORDER BY t.ano::text || t.letra) AS turmas
         FROM turma_alunos ta JOIN turmas t ON t.id = ta.turma_id JOIN escolas e ON e.id = t.escola_id
        WHERE ($4::uuid IS NULL OR t.professor_id = $4)
          AND ($5::uuid IS NULL OR t.escola_id = $5)
          AND ($6::smallint IS NULL OR t.ano = $6)
          AND ($7::text = '' OR t.letra = $7)
        GROUP BY ta.aluno_id
     )
     SELECT u.id, u.nome, u.email, u.turma, v.escolas, v.turmas, COUNT(p.id)::int AS partidas,
            COALESCE(SUM(p.acertos), 0)::int AS acertos,
            COALESCE(SUM(p.erros), 0)::int AS erros,
            MAX(p.criada_em) AS ultima_partida
       FROM usuarios u
       LEFT JOIN vinculos v ON v.aluno_id = u.id
       LEFT JOIN partidas p ON p.usuario_id = u.id
        AND ($2::date IS NULL OR p.criada_em >= $2::date)
        AND ($3::date IS NULL OR p.criada_em < ($3::date + INTERVAL '1 day'))
      WHERE u.perfil = 'aluno' AND u.ativo = TRUE AND u.status_professor = 'nao_aplicavel' AND ($1 = '' OR u.turma ILIKE '%' || $1 || '%')
        AND ($4::uuid IS NULL OR EXISTS (SELECT 1 FROM alunos_dos_professores pa WHERE pa.professor_id = $4 AND pa.aluno_id = u.id))
        AND (($5::uuid IS NULL AND $6::smallint IS NULL AND $7::text = '') OR v.aluno_id IS NOT NULL)
      GROUP BY u.id, u.nome, u.email, u.turma, v.escolas, v.turmas ORDER BY u.turma, u.nome, u.email`,
    [turma, de, ate, professorId, escolaId, ano, letra],
  );
  return dados.rows.map((aluno) => ({
    ...aluno,
    taxaAcerto:
      Number(aluno.acertos) + Number(aluno.erros)
        ? Math.round(
            (Number(aluno.acertos) /
              (Number(aluno.acertos) + Number(aluno.erros))) *
              100,
          )
        : 0,
  }));
}

module.exports = { registrar, listar, historicoAluno, relatorioProfessor };
