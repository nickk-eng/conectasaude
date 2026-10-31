const banco = require('../Config/banco');
const usuarioModel = require('../Model/usuarioModel');
const perguntaModel = require('../Model/perguntaModel');
const senhaService = require('../Service/senhaService');
const { MAX_TENTATIVAS_MFA, AUTOR_SEMENTE_ID } = require('../Config/constantes');

const COMANDOS = [
  'ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE',
  'ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS encerrada_em TIMESTAMPTZ',
  'ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS termos_aceitos_em TIMESTAMPTZ',
  'ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS termos_versao VARCHAR(20)',
  'ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS mfa_totp_segredo TEXT',
  'ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS mfa_totp_ativo BOOLEAN NOT NULL DEFAULT FALSE',
  "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS responsaveis_nome VARCHAR(240) NOT NULL DEFAULT ''",
  'ALTER TABLE usuarios DROP COLUMN IF EXISTS telefone',
  "CREATE TABLE IF NOT EXISTS desafios_mfa (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE, tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('login', 'configuracao')), segredo_temporario TEXT, criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), expira_em TIMESTAMPTZ NOT NULL, tentativas SMALLINT NOT NULL DEFAULT 0)",
  'DELETE FROM desafios_mfa',
  'ALTER TABLE desafios_mfa DROP COLUMN IF EXISTS telefone',
  'ALTER TABLE desafios_mfa DROP COLUMN IF EXISTS ultimo_envio_em',
  'ALTER TABLE desafios_mfa DROP COLUMN IF EXISTS reenvios',
  "ALTER TABLE desafios_mfa ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'login'",
  'ALTER TABLE desafios_mfa ADD COLUMN IF NOT EXISTS segredo_temporario TEXT',
  'CREATE INDEX IF NOT EXISTS desafios_mfa_usuario_expira_idx ON desafios_mfa(usuario_id, expira_em DESC)',
  `DELETE FROM desafios_mfa WHERE expira_em <= NOW() OR tentativas >= ${MAX_TENTATIVAS_MFA}`,
  "CREATE TABLE IF NOT EXISTS solicitacoes_privacidade (id BIGSERIAL PRIMARY KEY, usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE, tipo VARCHAR(30) NOT NULL, mensagem TEXT NOT NULL DEFAULT '', status VARCHAR(20) NOT NULL DEFAULT 'recebida', criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW())",
  'CREATE INDEX IF NOT EXISTS solicitacoes_privacidade_usuario_id_idx ON solicitacoes_privacidade(usuario_id)',
  'ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_email_key',
  'CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_ativo_idx ON usuarios(email) WHERE ativo = TRUE',
  "CREATE TABLE IF NOT EXISTS perguntas (id SERIAL PRIMARY KEY, texto VARCHAR(500) NOT NULL, alternativas JSONB NOT NULL, resposta_correta SMALLINT NOT NULL CHECK (resposta_correta BETWEEN 0 AND 2), nivel VARCHAR(10) NOT NULL DEFAULT 'Fácil', status VARCHAR(10) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'recusada')), autor_id UUID REFERENCES usuarios(id) ON DELETE SET NULL, avaliada_por UUID REFERENCES usuarios(id), criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), avaliada_em TIMESTAMPTZ)",
  "ALTER TABLE perguntas ADD COLUMN IF NOT EXISTS categoria_ist VARCHAR(30) NOT NULL DEFAULT 'prevencao-geral'",
  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'perguntas_categoria_ist_check') THEN
      ALTER TABLE perguntas ADD CONSTRAINT perguntas_categoria_ist_check
      CHECK (categoria_ist IN ('hiv-aids', 'sifilis', 'gonorreia', 'clamidia', 'hpv', 'herpes-genital', 'hepatites-virais', 'tricomoniase', 'prevencao-geral'));
    END IF;
  END $$`,
  'ALTER TABLE perguntas ALTER COLUMN autor_id DROP NOT NULL',
  "CREATE TABLE IF NOT EXISTS auditoria_acessos (id BIGSERIAL PRIMARY KEY, usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL, usuario_email VARCHAR(150), perfil VARCHAR(20), acao VARCHAR(80) NOT NULL, recurso VARCHAR(120) NOT NULL, detalhes JSONB NOT NULL DEFAULT '{}'::jsonb, metodo VARCHAR(10) NOT NULL, rota TEXT NOT NULL, ip VARCHAR(80), user_agent TEXT, criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW())",
  'CREATE INDEX IF NOT EXISTS auditoria_acessos_criado_em_idx ON auditoria_acessos(criado_em DESC)',
  'CREATE INDEX IF NOT EXISTS auditoria_acessos_usuario_id_idx ON auditoria_acessos(usuario_id)',
  `CREATE TABLE IF NOT EXISTS avaliacoes (
    id BIGSERIAL PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo VARCHAR(3) NOT NULL CHECK (tipo IN ('pre', 'pos')),
    perguntas JSONB NOT NULL,
    respostas JSONB,
    acertos SMALLINT,
    total SMALLINT NOT NULL,
    criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    concluida_em TIMESTAMPTZ,
    UNIQUE (usuario_id, tipo)
  )`,
  `CREATE TABLE IF NOT EXISTS partidas (
    id BIGSERIAL PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    acertos SMALLINT NOT NULL,
    erros SMALLINT NOT NULL,
    nivel VARCHAR(10) NOT NULL,
    modo VARCHAR(12) NOT NULL,
    resultado VARCHAR(80) NOT NULL DEFAULT '',
    criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  'CREATE INDEX IF NOT EXISTS partidas_usuario_id_idx ON partidas(usuario_id)'
];

async function prepararBanco() {
  for (const comando of COMANDOS) {
    await banco.query(comando);
  }
}

async function criarAdmin() {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_SENHA) return;

  const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
  let adminId = await usuarioModel.buscarIdAtivoPorEmail(email);

  if (!adminId) {
    adminId = await usuarioModel.criarAdmin(email, await senhaService.gerarHash(process.env.ADMIN_SENHA));
  }

  await perguntaModel.reatribuirAutor(AUTOR_SEMENTE_ID, adminId);
  await usuarioModel.excluir(AUTOR_SEMENTE_ID);
}

module.exports = { prepararBanco, criarAdmin };
