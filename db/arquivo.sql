BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'perfil_usuario'
    ) THEN
        CREATE TYPE perfil_usuario AS ENUM (
            'aluno',
            'professor',
            'admin'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(200) NOT NULL,
    email_hash VARCHAR(64) UNIQUE,
    email_criptografado TEXT,
    senha_hash TEXT NOT NULL,
    perfil perfil_usuario NOT NULL,
    nome VARCHAR(60) NOT NULL DEFAULT '',
    turma VARCHAR(60) NOT NULL DEFAULT '',
    responsaveis_nome VARCHAR(240) NOT NULL DEFAULT '',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    encerrada_em TIMESTAMPTZ,
    termos_aceitos_em TIMESTAMPTZ,
    termos_versao VARCHAR(20),
    mfa_totp_segredo TEXT,
    mfa_totp_ativo BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_hash_idx
    ON usuarios(email_hash)
    WHERE email_hash IS NOT NULL;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS solicitou_professor BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS status_professor VARCHAR(20) NOT NULL DEFAULT 'nao_aplicavel'
    CHECK (status_professor IN ('nao_aplicavel', 'nao_solicitado', 'pendente', 'aprovado', 'recusado', 'revogado'));

UPDATE usuarios SET status_professor = 'aprovado' WHERE perfil = 'professor' AND status_professor = 'nao_aplicavel';
UPDATE usuarios SET status_professor = 'pendente' WHERE perfil = 'aluno' AND solicitou_professor = TRUE AND status_professor = 'nao_aplicavel';

CREATE TABLE IF NOT EXISTS professor_alunos (
    professor_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    aluno_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (professor_id, aluno_id),
    CHECK (professor_id <> aluno_id)
);

CREATE INDEX IF NOT EXISTS professor_alunos_aluno_idx ON professor_alunos(aluno_id);

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


CREATE TABLE IF NOT EXISTS recuperacoes_senha (
    id UUID PRIMARY KEY,
    usuario_id UUID NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
    codigo_hash TEXT NOT NULL,
    token_hash TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expira_em TIMESTAMPTZ NOT NULL,
    tentativas SMALLINT NOT NULL DEFAULT 0
);

ALTER TABLE recuperacoes_senha ADD COLUMN IF NOT EXISTS token_hash TEXT;

CREATE TABLE IF NOT EXISTS sessoes (
    id UUID PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    expira_em TIMESTAMPTZ NOT NULL,
    criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sessoes_usuario_id_idx
    ON sessoes(usuario_id);

ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS termos_aceitos_em TIMESTAMPTZ;

ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS termos_versao VARCHAR(20);

ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS mfa_totp_segredo TEXT;

ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS mfa_totp_ativo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE usuarios
    DROP COLUMN IF EXISTS telefone;

CREATE TABLE IF NOT EXISTS desafios_mfa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('login', 'configuracao')),
    segredo_temporario TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expira_em TIMESTAMPTZ NOT NULL,
    tentativas SMALLINT NOT NULL DEFAULT 0
);

DELETE FROM desafios_mfa WHERE expira_em <= NOW() OR tentativas >= 5;

ALTER TABLE desafios_mfa
    DROP COLUMN IF EXISTS telefone;

ALTER TABLE desafios_mfa
    DROP COLUMN IF EXISTS ultimo_envio_em;

ALTER TABLE desafios_mfa
    DROP COLUMN IF EXISTS reenvios;

ALTER TABLE desafios_mfa
    ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'login';

ALTER TABLE desafios_mfa
    ADD COLUMN IF NOT EXISTS segredo_temporario TEXT;

CREATE INDEX IF NOT EXISTS desafios_mfa_usuario_expira_idx
    ON desafios_mfa(usuario_id, expira_em DESC);


CREATE TABLE IF NOT EXISTS auditoria_acessos (
    id BIGSERIAL PRIMARY KEY,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    usuario_email VARCHAR(200),
    perfil VARCHAR(20),
    acao VARCHAR(80) NOT NULL,
    recurso VARCHAR(120) NOT NULL,
    detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
    metodo VARCHAR(10) NOT NULL,
    rota TEXT NOT NULL,
    ip VARCHAR(80),
    user_agent TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auditoria_acessos_criado_em_idx
    ON auditoria_acessos(criado_em DESC);

CREATE INDEX IF NOT EXISTS auditoria_acessos_usuario_id_idx
    ON auditoria_acessos(usuario_id);

CREATE TABLE IF NOT EXISTS solicitacoes_privacidade (
    id BIGSERIAL PRIMARY KEY,
    usuario_id UUID NOT NULL
        REFERENCES usuarios(id)
        ON DELETE CASCADE,
    tipo VARCHAR(30) NOT NULL,
    mensagem TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'recebida',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS solicitacoes_privacidade_usuario_id_idx
    ON solicitacoes_privacidade(usuario_id);

CREATE TABLE IF NOT EXISTS perguntas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    texto TEXT NOT NULL,
    alternativas JSONB NOT NULL,
    resposta_correta INT NOT NULL,
    nivel VARCHAR(20) NOT NULL,
    categoria_ist VARCHAR(30) NOT NULL DEFAULT 'prevencao-geral' CHECK (categoria_ist IN ('hiv-aids', 'sifilis', 'gonorreia', 'clamidia', 'hpv', 'herpes-genital', 'hepatites-virais', 'tricomoniase', 'prevencao-geral')),
    status VARCHAR(20) NOT NULL DEFAULT 'pendente',
    autor_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


ALTER TABLE perguntas
    ADD COLUMN IF NOT EXISTS avaliada_por UUID
    REFERENCES usuarios(id)
    ON DELETE SET NULL;

ALTER TABLE perguntas
    ADD COLUMN IF NOT EXISTS avaliada_em TIMESTAMPTZ;


ALTER TABLE perguntas
    DROP CONSTRAINT IF EXISTS perguntas_resposta_correta_check;

ALTER TABLE perguntas
    ADD CONSTRAINT perguntas_resposta_correta_check
    CHECK (resposta_correta BETWEEN 0 AND 3);

INSERT INTO usuarios (
    id,
    email,
    senha_hash,
    perfil,
    nome
)
VALUES (
    '4cbe19df-8f77-4e17-990f-a84240734ff5',
    'aut*******@invalid.local',
    'seed-only-not-a-login',
    'professor',
    'Autor temporário das perguntas de exemplo'
)
ON CONFLICT (id) DO NOTHING;
INSERT INTO perguntas
(
    texto,
    alternativas,
    resposta_correta,
    nivel,
    status,
    autor_id
)
VALUES

(
    'Qual dessas situações não oferece risco de transmissão de uma IST?',
    '["Contato com feridas abertas na região genital", "Relação sexual vaginal sem proteção", "Compartilhar copos, talheres ou assentos de vaso sanitário", "Praticar sexo oral sem o uso de preservativo"]',
    2,
    'Fácil',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'Sobre sexo oral, é correto afirmar que:',
    '["É uma prática totalmente segura contra qualquer tipo de infecção", "Pode transmitir infecções como sífilis, herpes e gonorreia", "O uso de preservativo é desnecessário nessa prática", "Só oferece risco se houver ejaculação na boca"]',
    1,
    'Fácil',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'O que significa dizer que uma IST é assintomática?',
    '["Que a doença já foi curada pelo próprio organismo", "Que a doença só pode ser transmitida se houver dor", "Que a infecção está presente no corpo, mas não manifesta sinais visíveis", "Que a pessoa apresenta sintomas leves, como uma gripe"]',
    2,
    'Fácil',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'Se um jovem teve uma relação sexual de risco, qual é o prazo máximo para iniciar a PEP (Profilaxia Pós-Exposição)?',
    '["Até uma semana depois", "Somente se aparecerem os primeiros sintomas", "Até 24 horas após a ejaculação", "Até 72 horas após a relação"]',
    3,
    'Médio',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'Sobre o uso da pílula anticoncepcional e a proteção contra ISTs:',
    '["A pílula previne a gravidez, mas não protege contra nenhuma IST", "Quem toma pílula não precisa usar camisinha", "A pílula aumenta a imunidade contra o vírus HIV", "A pílula protege contra gravidez e contra a maioria das ISTs"]',
    0,
    'Fácil',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'No Brasil, o adolescente tem direito a ser atendido sozinho em uma unidade de saúde?',
    '["Somente em clínicas particulares, mas não no SUS", "Apenas se tiver autorização por escrito dos responsáveis", "Sim, desde que tenha maturidade para entender sua saúde e não corra risco de vida", "Não é obrigatória a presença dos pais até os 18 anos"]',
    2,
    'Médio',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'Qual IST pode ser prevenida através de uma vacina disponível gratuitamente no SUS para jovens?',
    '["HPV", "Sífilis", "Gonorreia", "HIV"]',
    0,
    'Fácil',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'A sífilis é uma doença que:',
    '["Só atinge pessoas idosas", "É transmitida apenas pelo suor", "Não tem tratamento e leva sempre à morte", "Pode apresentar feridas que somem sozinhas, o que pode dar a falsa ideia de cura"]',
    3,
    'Fácil',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'O preservativo deve ser colocado em qual momento?',
    '["Logo após o início da penetração", "Antes de qualquer contato entre os órgãos genitais", "Apenas se o parceiro ou parceira parecer doente", "Somente no momento da ejaculação"]',
    1,
    'Fácil',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'O que são os testes rápidos oferecidos nos CTAs (Centros de Testagem e Aconselhamento)?',
    '["Testes que detectam anticorpos em cerca de 30 minutos", "Exames de sangue complexos que exigem jejum de 12 horas", "Exames que demoram 30 dias para ficar prontos", "Testes de farmácia que não têm validade médica"]',
    0,
    'Fácil',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'Sobre o herpes genital, é verdadeiro afirmar que:',
    '["É transmitido apenas quando as bolhas estão visíveis", "Pode ser curado com o uso de sabonetes especiais", "Uma vez infectada, a pessoa pode ter crises em momentos de baixa imunidade", "Não causa dor, apenas coceira leve"]',
    2,
    'Médio',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'Qual é a função do lubrificante à base de água no uso da camisinha?',
    '["Aumentar as chances de a camisinha estourar", "Matar espermatozoides e vírus", "Diminuir o atrito e o risco de rompimento do preservativo", "Nenhuma. Serve apenas para dar conforto"]',
    2,
    'Fácil',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'Por que o beijo na boca raramente transmite o HIV?',
    '["O beijo transmite HIV da mesma forma que o sexo", "Porque o vírus morre em contato com a língua", "Porque a concentração do vírus na saliva é muito baixa", "Porque o estômago destrói o vírus se ele for engolido"]',
    2,
    'Fácil',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'Qual é a recomendação para quem tem múltiplos parceiros ou parceiras?',
    '["Tomar antibióticos preventivos todos os meses", "Fazer exames de rotina e testagem regular, mesmo sem sintomas", "Lavar-se bem após a relação substitui a camisinha", "Confiar na palavra do parceiro ou parceira sobre sua saúde"]',
    1,
    'Fácil',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'Qual é a faixa etária indicada para vacinação contra o HPV pelo SUS?',
    '["5 a 8 anos", "9 a 14 anos", "20 a 30 anos"]',
    1,
    'Fácil',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'Qual hepatite pode ser transmitida pelo contato com sangue contaminado e pela relação sexual?',
    '["Hepatite A", "Hepatite B", "Hepatite E"]',
    1,
    'Fácil',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'O teste rápido pode diagnosticar quais dessas infecções?',
    '["Apenas HIV", "Apenas sífilis", "HIV e sífilis"]',
    2,
    'Fácil',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'Algumas ISTs podem aumentar o risco de adquirir outras infecções porque:',
    '["Enfraquecem as barreiras naturais do organismo", "Não interferem em outras doenças", "Protegem o corpo contra vírus"]',
    0,
    'Médio',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'A prevenção combinada das ISTs envolve:',
    '["Apenas o uso de medicamentos", "Estratégias como preservativo, testagem, vacinação e tratamento", "Apenas abstinência sexual"]',
    1,
    'Fácil',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'O que deve ser feito ao perceber feridas ou lesões na região genital?',
    '["Ignorar e esperar melhorar", "Usar qualquer pomada", "Procurar atendimento de saúde"]',
    2,
    'Difícil',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'O tratamento correto da sífilis também deve incluir:',
    '["Apenas a pessoa infectada", "Apenas familiares", "O parceiro ou parceira sexual"]',
    2,
    'Médio',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'Uma pessoa que já tomou a vacina contra HPV ainda precisa usar preservativo?',
    '["Sim, porque a vacina não protege contra todas as ISTs", "Não precisa mais", "Apenas em algumas situações"]',
    0,
    'Difícil',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'É possível pegar uma IST apenas pelo contato com secreções genitais, sem penetração?',
    '["Não, só ocorre com penetração", "Sim, o contato com secreções também pode transmitir", "Apenas se houver sangue"]',
    1,
    'Fácil',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'O teste rápido para IST pode ser feito em:',
    '["Apenas hospitais grandes", "Unidades Básicas de Saúde", "Apenas laboratórios privados"]',
    1,
    'Difícil',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'Uma pessoa que já teve sífilis pode contrair a infecção novamente?',
    '["Não", "Sim, se tiver nova exposição", "Apenas depois de muitos anos"]',
    1,
    'Fácil',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'Qual hepatite pode ser transmitida pelo contato com sangue contaminado e pela relação sexual?',
    '["Hepatite A", "Hepatite B", "Hepatite E"]',
    1,
    'Fácil',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'Qual é a diferença entre HIV e AIDS?',
    '["HIV é o vírus que infecta o organismo, e a AIDS é o estágio avançado da infecção que compromete o sistema imunológico", "HIV e AIDS são nomes diferentes para a mesma doença", "AIDS é um vírus e HIV é uma bactéria", "HIV tem cura e AIDS não tem tratamento"]',
    0,
    'Médio',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'Qual fator pode aumentar o risco de transmissão de IST durante a relação sexual?',
    '["Uso correto de preservativo", "Presença de feridas ou lesões genitais", "Realizar exames periódicos", "Vacinação"]',
    1,
    'Difícil',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'Sobre a transmissão de HIV, é correto afirmar que:',
    '["É possível contrair HIV pelo beijo na boca se não houver sangramento", "HIV pode ser transmitido através de picadas de mosquito", "HIV só é transmitido por contato direto com sangue, sêmen, secreções vaginais ou leite materno", "É possível pegar HIV usando a mesma toalha de banheiro"]',
    2,
    'Médio',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'Sobre o HPV (Papilomavírus Humano), é verdadeiro afirmar:',
    '["A vacina protege contra todos os tipos de HPV", "Apenas mulheres precisam se vacinar", "Homens também podem se vacinar e prevenir verrugas genitais e câncer", "Se a pessoa já teve HPV, não precisa mais de preservativo"]',
    2,
    'Médio',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'Sobre herpes genital:',
    '["Só é transmissível quando aparecem bolhas visíveis", "Pode ser transmitido mesmo sem sintomas aparentes", "Não há tratamento disponível", "É uma doença que só afeta pessoas adultas"]',
    1,
    'Fácil',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'Sobre a clamídia, é verdadeiro que:',
    '["É uma IST que pode causar infertilidade se não tratada", "Não pode ser transmitida sexualmente", "Sempre provoca dor intensa", "Não existe teste disponível"]',
    0,
    'Difícil',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'Qual das ações abaixo não ajuda a prevenir ISTs?',
    '["Uso correto de camisinha em todas as relações sexuais", "Testagem regular para ISTs", "Limpeza íntima após a relação sexual", "Vacinação contra HPV e hepatite B"]',
    2,
    'Fácil',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
),

(
    'Sobre testagem rápida para ISTs:',
    '["Só é útil se houver sintomas", "Detecta infecções como HIV e sífilis em cerca de 30 minutos", "Exames só podem ser feitos em laboratórios privados", "Após um teste negativo, não é necessário repetir nunca"]',
    1,
    'Fácil',
    'aprovada',
    '4cbe19df-8f77-4e17-990f-a84240734ff5'
);


CREATE TABLE IF NOT EXISTS avaliacoes (
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
);

CREATE TABLE IF NOT EXISTS partidas (
    id BIGSERIAL PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    acertos SMALLINT NOT NULL,
    erros SMALLINT NOT NULL,
    nivel VARCHAR(10) NOT NULL,
    modo VARCHAR(12) NOT NULL,
    resultado VARCHAR(80) NOT NULL DEFAULT '',
    criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS partidas_usuario_id_idx
    ON partidas(usuario_id);

ALTER TABLE desafios_mfa DROP CONSTRAINT IF EXISTS desafios_mfa_tipo_check;
ALTER TABLE desafios_mfa ADD CONSTRAINT desafios_mfa_tipo_check CHECK (tipo IN ('login', 'configuracao', 'email'));
ALTER TABLE desafios_mfa ADD COLUMN IF NOT EXISTS codigo_hash TEXT;
ALTER TABLE solicitacoes_privacidade ADD COLUMN IF NOT EXISTS resposta TEXT NOT NULL DEFAULT '';
ALTER TABLE solicitacoes_privacidade ADD COLUMN IF NOT EXISTS respondida_em TIMESTAMPTZ;
ALTER TABLE solicitacoes_privacidade ADD COLUMN IF NOT EXISTS respondida_por UUID REFERENCES usuarios(id);
ALTER TABLE solicitacoes_privacidade ALTER COLUMN usuario_id DROP NOT NULL;
ALTER TABLE solicitacoes_privacidade ADD COLUMN IF NOT EXISTS providencia TEXT NOT NULL DEFAULT '';
ALTER TABLE solicitacoes_privacidade ADD COLUMN IF NOT EXISTS comprovante TEXT NOT NULL DEFAULT '';
ALTER TABLE solicitacoes_privacidade ADD COLUMN IF NOT EXISTS verificada_em TIMESTAMPTZ;
COMMIT;
