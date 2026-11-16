CREATE TABLE IF NOT EXISTS turmas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professor_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    ano SMALLINT NOT NULL CHECK (ano BETWEEN 1 AND 3),
    letra VARCHAR(1) NOT NULL CHECK (letra ~ '^[A-Z]$'),
    escola VARCHAR(150) NOT NULL CHECK (length(trim(escola)) > 0),
    descricao VARCHAR(1000) NOT NULL DEFAULT '',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS turmas_professor_escola_ano_letra_idx
    ON turmas(professor_id, lower(escola), ano, letra);

CREATE TABLE IF NOT EXISTS turma_alunos (
    turma_id UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (turma_id, aluno_id)
);

CREATE INDEX IF NOT EXISTS turma_alunos_aluno_idx ON turma_alunos(aluno_id);

CREATE OR REPLACE VIEW alunos_dos_professores AS
    SELECT professor_id, aluno_id FROM professor_alunos
    UNION
    SELECT t.professor_id, ta.aluno_id
    FROM turmas t JOIN turma_alunos ta ON ta.turma_id = t.id;
