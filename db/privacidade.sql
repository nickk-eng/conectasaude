ALTER TABLE solicitacoes_privacidade
ALTER COLUMN usuario_id
DROP NOT NULL;

ALTER TABLE solicitacoes_privacidade
ADD COLUMN IF NOT EXISTS providencia TEXT NOT NULL DEFAULT '';

ALTER TABLE solicitacoes_privacidade
ADD COLUMN IF NOT EXISTS comprovante TEXT NOT NULL DEFAULT '';

ALTER TABLE solicitacoes_privacidade
ADD COLUMN IF NOT EXISTS verificada_em TIMESTAMPTZ;