const banco = require("../Config/banco");
const { ANOS_ENSINO_MEDIO } = require("../Config/constantes");

function paraPublico(turma) {
  return { ...turma, nome: `${turma.ano}${turma.letra}` };
}

async function listar(professorId) {
  const dados = await banco.query(
    `SELECT t.id, t.ano, t.letra, e.nome AS escola, e.id AS "escolaId", t.descricao, COUNT(u.id)::int AS "totalAlunos"
       FROM turmas t JOIN escolas e ON e.id = t.escola_id LEFT JOIN turma_alunos ta ON ta.turma_id = t.id
       LEFT JOIN usuarios u ON u.id = ta.aluno_id AND u.ativo = TRUE AND u.perfil = 'aluno' AND u.status_professor = 'nao_aplicavel'
      WHERE t.professor_id = $1 GROUP BY t.id, e.id ORDER BY lower(e.nome), t.ano, t.letra, t.id`,
    [professorId],
  );
  const antigos = await banco.query(
    `SELECT COUNT(*)::int AS total FROM professor_alunos pa JOIN usuarios u ON u.id = pa.aluno_id
      WHERE pa.professor_id = $1 AND u.ativo = TRUE AND u.perfil = 'aluno' AND u.status_professor = 'nao_aplicavel'`,
    [professorId],
  );
  return {
    turmas: dados.rows.map(paraPublico),
    escolas: await listarEscolas(professorId),
    alunosSemTurma: antigos.rows[0].total,
  };
}

async function listarEscolas(professorId) {
  const dados = await banco.query(
    "SELECT id, nome FROM escolas WHERE professor_id = $1 ORDER BY lower(nome), id",
    [professorId],
  );
  return dados.rows;
}

async function criar(professorId, { ano, letra, escolaId, escola, descricao }) {
  const cliente = await banco.connect();
  try {
    await cliente.query("BEGIN");
    const selecionada = escolaId
      ? await cliente.query(
          "SELECT id, nome FROM escolas WHERE id = $1 AND professor_id = $2",
          [escolaId, professorId],
        )
      : await cliente.query(
          `INSERT INTO escolas (professor_id, nome)
         SELECT id, $2 FROM usuarios WHERE id = $1 AND perfil = 'professor' AND ativo = TRUE
         ON CONFLICT (professor_id, lower(nome)) DO UPDATE SET nome = escolas.nome
         RETURNING id, nome`,
          [professorId, escola.normalize("NFC").trim().replace(/\s+/g, " ")],
        );
    if (!selecionada.rows[0]) {
      await cliente.query("ROLLBACK");
      return null;
    }
    const registro = selecionada.rows[0];
    const dados = await cliente.query(
      `INSERT INTO turmas (professor_id, ano, letra, escola, escola_id, descricao)
       SELECT id, $2, $3, $4, $5, $6 FROM usuarios WHERE id = $1 AND perfil = 'professor' AND ativo = TRUE
       RETURNING id, ano, letra, escola, escola_id AS "escolaId", descricao`,
      [professorId, ano, letra, registro.nome, registro.id, descricao],
    );
    if (!dados.rows[0]) {
      await cliente.query("ROLLBACK");
      return null;
    }
    await cliente.query("COMMIT");
    return paraPublico(dados.rows[0]);
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
}

async function buscar(professorId, turmaId) {
  const dados = await banco.query(
    `SELECT t.id, t.ano, t.letra, e.nome AS escola, e.id AS "escolaId", t.descricao
       FROM turmas t JOIN escolas e ON e.id = t.escola_id WHERE t.id = $1 AND t.professor_id = $2`,
    [turmaId, professorId],
  );
  return dados.rows[0] ? paraPublico(dados.rows[0]) : null;
}

async function pesquisar(professorId, { turmaId, busca, vinculo, pagina }) {
  const turma = await buscar(professorId, turmaId);
  if (!turma) return null;
  const dados = await banco.query(
    `SELECT u.id, u.nome, u.email, u.turma,
            EXISTS (SELECT 1 FROM turma_alunos ta WHERE ta.turma_id = $1 AND ta.aluno_id = u.id) AS vinculado
       FROM usuarios u
      WHERE u.perfil = 'aluno' AND u.ativo = TRUE AND u.status_professor = 'nao_aplicavel'
        AND (translate(lower(u.nome || ' ' || u.email), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
          LIKE '%' || $2 || '%' ESCAPE '!')
        AND (($3 = 'minha' AND EXISTS (SELECT 1 FROM turma_alunos ta WHERE ta.turma_id = $1 AND ta.aluno_id = u.id))
          OR ($3 = 'disponiveis' AND u.turma = $5 AND NOT EXISTS (SELECT 1 FROM turma_alunos ta WHERE ta.turma_id = $1 AND ta.aluno_id = u.id)))
      ORDER BY u.nome, u.email, u.id LIMIT 6 OFFSET $4`,
    [
      turmaId,
      busca
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[!%_]/g, "!$&"),
      vinculo,
      (pagina - 1) * 5,
      ANOS_ENSINO_MEDIO[turma.ano - 1],
    ],
  );
  return {
    turma,
    alunos: dados.rows.slice(0, 5),
    temMais: dados.rows.length > 5,
    pagina,
  };
}

async function buscarAlunoParaRevelacao(professorId, alunoId) {
  const dados = await banco.query(
    `SELECT u.id, u.nome, u.email, u.email_criptografado,
            EXISTS (
              SELECT 1 FROM turma_alunos ta JOIN turmas t ON t.id = ta.turma_id
               WHERE ta.aluno_id = u.id AND t.professor_id = $1
            ) AS autorizado
       FROM usuarios u
      WHERE u.id = $2 AND u.perfil = 'aluno' AND u.ativo = TRUE
        AND u.status_professor = 'nao_aplicavel'`,
    [professorId, alunoId],
  );
  return dados.rows[0] || null;
}

async function resumoDashboard(professorId) {
  const dados = await banco.query(
    `WITH alunos AS (
       SELECT aluno_id FROM alunos_dos_professores WHERE professor_id = $1
     )
     SELECT
       (SELECT COUNT(*)::int FROM turmas WHERE professor_id = $1) AS "totalTurmas",
       (SELECT COUNT(DISTINCT a.aluno_id)::int FROM alunos a JOIN usuarios u ON u.id = a.aluno_id
         WHERE u.ativo = TRUE AND u.perfil = 'aluno' AND u.status_professor = 'nao_aplicavel') AS "totalAlunos",
       (SELECT COUNT(*)::int FROM partidas p JOIN alunos a ON a.aluno_id = p.usuario_id
         JOIN usuarios u ON u.id = p.usuario_id
         WHERE u.ativo = TRUE AND u.perfil = 'aluno' AND u.status_professor = 'nao_aplicavel') AS "totalPartidas"`,
    [professorId],
  );
  return dados.rows[0];
}

async function adicionar(professorId, turmaId, alunoId) {
  const cliente = await banco.connect();
  try {
    await cliente.query("BEGIN");
    const dados = await cliente.query(
      `INSERT INTO turma_alunos (turma_id, aluno_id)
       SELECT t.id, a.id FROM turmas t JOIN usuarios p ON p.id = t.professor_id CROSS JOIN usuarios a
        WHERE t.id = $1 AND t.professor_id = $2 AND p.ativo = TRUE AND p.perfil = 'professor'
          AND a.id = $3 AND a.ativo = TRUE AND a.perfil = 'aluno' AND a.status_professor = 'nao_aplicavel'
          AND a.turma = ($4::text[])[t.ano]
       ON CONFLICT (turma_id, aluno_id) DO UPDATE SET aluno_id = EXCLUDED.aluno_id
       RETURNING aluno_id`,
      [turmaId, professorId, alunoId, ANOS_ENSINO_MEDIO],
    );
    if (dados.rowCount)
      await cliente.query(
        "DELETE FROM professor_alunos WHERE professor_id = $1 AND aluno_id = $2",
        [professorId, alunoId],
      );
    await cliente.query("COMMIT");
    return dados.rowCount > 0;
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
}

async function remover(professorId, turmaId, alunoId) {
  await banco.query(
    `DELETE FROM turma_alunos ta USING turmas t WHERE ta.turma_id = t.id
      AND t.professor_id = $1 AND t.id = $2 AND ta.aluno_id = $3`,
    [professorId, turmaId, alunoId],
  );
}

module.exports = {
  listar,
  listarEscolas,
  criar,
  buscar,
  pesquisar,
  buscarAlunoParaRevelacao,
  resumoDashboard,
  adicionar,
  remover,
};
