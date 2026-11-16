CREATE TABLE IF NOT EXISTS escolas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professor_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome VARCHAR(150) NOT NULL CHECK (length(trim(nome)) > 0),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (id, professor_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS escolas_professor_nome_idx ON escolas(professor_id, lower(nome));

ALTER TABLE turmas ADD COLUMN IF NOT EXISTS escola_id UUID;

INSERT INTO escolas (professor_id, nome)
SELECT professor_id, MIN(trim(regexp_replace(escola, '[[:space:]]+', ' ', 'g')))
FROM turmas
GROUP BY professor_id, lower(trim(regexp_replace(escola, '[[:space:]]+', ' ', 'g')))
ON CONFLICT (professor_id, lower(nome)) DO NOTHING;

UPDATE turmas t SET escola_id = e.id
FROM escolas e
WHERE t.escola_id IS NULL AND e.professor_id = t.professor_id
  AND lower(e.nome) = lower(trim(regexp_replace(t.escola, '[[:space:]]+', ' ', 'g')));

ALTER TABLE turmas ALTER COLUMN escola_id SET NOT NULL;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'turmas_escola_professor_fk' AND conrelid = 'turmas'::regclass) THEN
        ALTER TABLE turmas ADD CONSTRAINT turmas_escola_professor_fk
            FOREIGN KEY (escola_id, professor_id) REFERENCES escolas(id, professor_id);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS turmas_professor_escola_id_ano_letra_idx ON turmas(professor_id, escola_id, ano, letra);
