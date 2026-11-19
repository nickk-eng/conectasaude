ALTER TABLE solicitacoes_privacidade
ALTER COLUMN usuario_id
DROP NOT NULL;

ALTER TABLE solicitacoes_privacidade
ADD COLUMN IF NOT EXISTS providencia TEXT NOT NULL DEFAULT '';

ALTER TABLE solicitacoes_privacidade
ADD COLUMN IF NOT EXISTS comprovante TEXT NOT NULL DEFAULT '';

ALTER TABLE solicitacoes_privacidade
ADD COLUMN IF NOT EXISTS verificada_em TIMESTAMPTZ;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_hash VARCHAR(64);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_criptografado TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_hash_idx ON usuarios(email_hash) WHERE email_hash IS NOT NULL;
