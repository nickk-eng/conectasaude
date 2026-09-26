const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const app = express();
const banco = new Pool({ connectionString: process.env.DATABASE_URL });
const view = path.join(__dirname, 'View');
const VERSAO_TERMOS = '1.0';
const AUTOR_SEMENTE_ID = '4cbe19df-8f77-4e17-990f-a84240734ff5';


app.use(express.json());
app.use('/css', express.static(path.join(view, 'css')));
app.use('/js', express.static(path.join(view, 'js')));
app.use('/img', express.static(path.join(__dirname, 'img')));

function hash(senha) {
  return bcrypt.hash(senha, 12);
}


function confereSenha(senha, salva) {
  return bcrypt.compare(senha, salva);
}

function publico(usuario) { 
  return { 
    id: usuario.id, 
    email: usuario.email, 
    nome: usuario.nome, 
    perfil: usuario.perfil, 
    turma: usuario.turma 
  }; 
}

function ipCliente(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
    .split(',')[0]
    .trim();
}

async function registrarAuditoria(req, acao, recurso, detalhes = {}, usuarioInformado = null) {
  try {
    const usuario = usuarioInformado || req.usuario || null;
    await banco.query(
      `INSERT INTO auditoria_acessos
        (usuario_id, usuario_email, perfil, acao, recurso, detalhes, metodo, rota, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        usuario?.id || null,
        usuario?.email || detalhes.email || null,
        usuario?.perfil || null,
        acao,
        recurso,
        JSON.stringify(detalhes || {}),
        req.method,
        req.originalUrl,
        ipCliente(req),
        String(req.get('User-Agent') || '').slice(0, 300)
      ]
    );
  } catch (erro) {
    console.error('Erro ao registrar auditoria:', erro.message);
  }
}

async function usuarioLogado(req) {
  const [tipo, token] = String(req.get('Authorization') || '').trim().split(/\s+/, 2);
  if (tipo !== 'Bearer' || !token) return null;
  
  const resultado = await banco.query('SELECT u.id, u.email, u.nome, u.perfil, u.turma FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id WHERE s.id = $1 AND s.expira_em > NOW()', [token]);
  return resultado.rows[0] || null;
}

async function autenticar(req, res, next) { 
  const usuario = await usuarioLogado(req); 
  if (!usuario) {
    return res.status(401).json({ mensagem: 'Faça login para continuar.' }); 
  }
  
  req.usuario = usuario; 
  next(); 
}

function permitir(...perfis) { 
  return (req, res, next) => 
    perfis.includes(req.usuario.perfil) 
      ? next() 
      : res.status(403).json({ mensagem: 'Você não tem acesso a esta área.' }); 
}

function pagina(arquivo) { 
  return (_req, res) => res.sendFile(path.join(view, 'html', arquivo));
}

app.post('/api/auth/cadastro', async (req, res) => {
  const { email, senha, confirmarSenha, perfil, aceitouTermos } = req.body;
  const emailLimpo = String(email || '').trim().toLowerCase();
  
  if (!emailLimpo || !senha) {
    return res.status(400).json({ mensagem: 'Informe um e-mail e uma senha.' });
  }

  if (senha.length < 8 || !/[A-Z]/.test(senha) || !/[0-9]/.test(senha) || !/[^A-Za-z0-9]/.test(senha)) {
    return res.status(400).json({ mensagem: 'A senha precisa ter pelo menos 8 caracteres, uma letra maiúscula, um número e um caractere especial.' });
  }

  if (senha !== confirmarSenha) {
    return res.status(400).json({ mensagem: 'As senhas não são iguais.' });
  }

  if (aceitouTermos !== true) {
    return res.status(400).json({ mensagem: 'É necessário aceitar os Termos de Uso para criar a conta.' });
  }

  if (!['aluno', 'professor'].includes(perfil)) {
    return res.status(400).json({ mensagem: 'Escolha aluno ou professor.' });
  }
      
  try { 
    const resultado = await banco.query('INSERT INTO usuarios (email, senha_hash, perfil, termos_aceitos_em, termos_versao) VALUES ($1, $2, $3, NOW(), $4) RETURNING id, email, nome, perfil, turma', [emailLimpo, await hash(senha), perfil, VERSAO_TERMOS]); 
    await registrarAuditoria(req, 'cadastro_criado', 'usuarios', { email: emailLimpo, perfil }, resultado.rows[0]);
    res.status(201).json({ mensagem: 'Conta criada. Agora você pode entrar.' }); 
  } catch (erro) {
    if (erro.code === '23505') {
      await registrarAuditoria(req, 'cadastro_recusado', 'usuarios', { email: emailLimpo, motivo: 'email_duplicado' });
      return res.status(409).json({ mensagem: 'Já existe uma conta com este e-mail.' });
    }
    console.error('Erro ao criar conta:', erro.message);
    res.status(503).json({ mensagem: 'Não foi possível acessar o banco de dados. Configure o arquivo .env e tente novamente.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const senha = String(req.body.senha || '');
    const resultado = await banco.query(
      'SELECT * FROM usuarios WHERE email = $1 AND ativo = TRUE',
      [email]
    );
    const usuario = resultado.rows[0];

    if (!usuario || !(await confereSenha(senha, usuario.senha_hash))) {
      await registrarAuditoria(req, 'login_falhou', 'autenticacao', {
        email,
        motivo: 'credenciais_invalidas'
      });
      return res.status(401).json({ mensagem: 'E-mail ou senha inválidos.' });
    }

    const sessao = await banco.query(
      `INSERT INTO sessoes (id, usuario_id, expira_em)
       VALUES (gen_random_uuid(), $1, NOW() + INTERVAL '8 hours')
       RETURNING id`,
      [usuario.id]
    );
    const token = sessao.rows[0].id;
    await registrarAuditoria(req, 'login_realizado', 'autenticacao', {}, usuario);
    res.json({ usuario: publico(usuario), token });
  } catch (erro) {
    console.error('Erro ao entrar:', erro.message);
    res.status(503).json({ mensagem: 'Não foi possível acessar o servidor. Tente novamente.' });
  }
});

app.post('/api/auth/recuperar-senha', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const novaSenha = String(req.body.novaSenha || '');
  const confirmarSenha = String(req.body.confirmarSenha || '');
  if (!email) return res.status(400).json({ mensagem: 'Informe o e-mail da conta.' });
  if (novaSenha.length < 8) return res.status(400).json({ mensagem: 'A senha precisa ter pelo menos 8 caracteres.' });
  if (novaSenha !== confirmarSenha) return res.status(400).json({ mensagem: 'As senhas não são iguais.' });

  try {
    const resultado = await banco.query(
      'UPDATE usuarios SET senha_hash = $1 WHERE email = $2 AND ativo = TRUE RETURNING id, email, perfil',
      [await hash(novaSenha), email]
    );
    if (resultado.rowCount) {
      await banco.query('DELETE FROM sessoes WHERE usuario_id = $1', [resultado.rows[0].id]);
      await registrarAuditoria(req, 'senha_redefinida', 'autenticacao', {}, resultado.rows[0]);
    }
    res.json({ mensagem: 'Se o e-mail estiver cadastrado, a senha foi atualizada. Você já pode entrar.' });
  } catch (erro) {
    console.error('Erro ao redefinir senha:', erro.message);
    res.status(503).json({ mensagem: 'Não foi possível redefinir a senha. Tente novamente.' });
  }
});
app.post('/api/auth/encerrar-conta', autenticar, async (req, res) => {
  const senha = String(req.body.senha || '');
  const consultaConta = await banco.query('SELECT senha_hash FROM usuarios WHERE id = $1 AND ativo = TRUE', [req.usuario.id]);
  if (!consultaConta.rows[0] || !(await confereSenha(senha, consultaConta.rows[0].senha_hash))) {
    return res.status(401).json({ mensagem: 'Senha incorreta. A conta não foi encerrada.' });
  }

  const cliente = await banco.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('UPDATE perguntas SET autor_id = NULL WHERE autor_id = $1', [req.usuario.id]);
    await cliente.query(
      `UPDATE auditoria_acessos
       SET usuario_id = NULL, usuario_email = NULL, perfil = NULL, ip = NULL, user_agent = NULL,
           detalhes = detalhes - 'email'
       WHERE usuario_id = $1 OR usuario_email = $2`,
      [req.usuario.id, req.usuario.email]
    );
    await cliente.query(
      `UPDATE usuarios
       SET ativo = FALSE, encerrada_em = NOW(), senha_hash = '',
           email = 'anonimizado+' || id::text || '@invalid.local',
           nome = 'Autor anonimizado', turma = '',
           termos_aceitos_em = NULL, termos_versao = NULL
       WHERE id = $1 AND ativo = TRUE`,
      [req.usuario.id]
    );
    await cliente.query('DELETE FROM sessoes WHERE usuario_id = $1', [req.usuario.id]);
    await cliente.query(
      `INSERT INTO auditoria_acessos
        (usuario_id, usuario_email, perfil, acao, recurso, detalhes, metodo, rota, ip, user_agent)
       VALUES (NULL, NULL, NULL, 'conta_encerrada', 'usuarios', $1, $2, $3, NULL, NULL)`,
      [JSON.stringify({ perguntas_preservadas_com_autoria_anonimizada: true }), req.method, req.originalUrl]
    );
    await cliente.query('COMMIT');
  } catch (erro) {
    await cliente.query('ROLLBACK');
    console.error('Erro ao encerrar conta:', erro.message);
    return res.status(503).json({ mensagem: 'Não foi possível encerrar a conta. Tente novamente.' });
  } finally {
    cliente.release();
  }
  res.json({ mensagem: 'Conta encerrada. Suas perguntas permanecem no sistema com autoria anonimizada. Você será desconectado.' });
});
app.post('/api/auth/sair', autenticar, async (req, res) => { 
  const [, token] = String(req.get('Authorization') || '').trim().split(/\s+/, 2);
  await banco.query('DELETE FROM sessoes WHERE id = $1', [token]);
  await registrarAuditoria(req, 'logout_realizado', 'autenticacao');
  res.status(204).end(); 
});

app.get('/api/auth/eu', autenticar, (req, res) => {
  res.json({ usuario: publico(req.usuario) });
});


app.put('/api/usuario/perfil', autenticar, permitir('aluno', 'professor'), async (req, res) => {
  const nome = String(req.body.nome || '').trim().slice(0, 60);
  const turma = req.usuario.perfil === 'aluno' ? String(req.body.turma || '').trim().slice(0, 60) : '';
  if (!nome) return res.status(400).json({ mensagem: 'Informe seu nome.' });
  if (req.usuario.perfil === 'aluno' && !turma) return res.status(400).json({ mensagem: 'Informe sua turma ou ano.' });
  const resultado = await banco.query(
    'UPDATE usuarios SET nome = $1, turma = $2 WHERE id = $3 RETURNING id, email, nome, perfil, turma',
    [nome, turma, req.usuario.id]
  );
  await registrarAuditoria(req, 'perfil_atualizado', req.usuario.perfil, { informouNome: true, informouTurma: Boolean(turma) });
  res.json({ usuario: publico(resultado.rows[0]) });
});
app.post('/api/privacidade/solicitacoes', autenticar, async (req, res) => {
  const tiposPermitidos = ['acesso', 'correcao', 'eliminacao', 'portabilidade', 'oposicao', 'informacoes'];
  const tipo = String(req.body.tipo || '');
  const mensagem = String(req.body.mensagem || '').trim().slice(0, 1000);
  if (!tiposPermitidos.includes(tipo)) {
    return res.status(400).json({ mensagem: 'Selecione um tipo de solicitação válido.' });
  }

  try {
    const resultado = await banco.query(
      'INSERT INTO solicitacoes_privacidade (usuario_id, tipo, mensagem) VALUES ($1, $2, $3) RETURNING id',
      [req.usuario.id, tipo, mensagem]
    );
    await registrarAuditoria(req, 'solicitacao_privacidade_criada', 'privacidade', { solicitacaoId: resultado.rows[0].id, tipo });
    res.status(201).json({ mensagem: 'Solicitação registrada para análise da equipe do projeto.' });
  } catch (erro) {
    console.error('Erro ao registrar solicitação de privacidade:', erro.message);
    res.status(503).json({ mensagem: 'Não foi possível registrar a solicitação. Tente novamente.' });
  }
});
app.put('/api/aluno/perfil', autenticar, permitir('aluno'), async (req, res) => { 
  const nome = String(req.body.nome || '').trim().slice(0, 60); 
  const turma = String(req.body.turma || '').trim().slice(0, 60); 
  if (!turma) {
    return res.status(400).json({ mensagem: 'Informe a turma.' }); 
  }
  const resultado = await banco.query('UPDATE usuarios SET nome = $1, turma = $2 WHERE id = $3 RETURNING id, email, nome, perfil, turma', [nome, turma, req.usuario.id]); 
  await registrarAuditoria(req, 'perfil_atualizado', 'aluno', { turma, informouNome: Boolean(nome) });
  res.json({ usuario: publico(resultado.rows[0]) }); 
});

app.get('/api/professor/alunos', autenticar, permitir('professor', 'admin'), async (req, res) => { 
  const dados = await banco.query("SELECT id, email, nome, perfil, turma FROM usuarios WHERE perfil = 'aluno' AND ativo = TRUE ORDER BY nome, email"); 
  await registrarAuditoria(req, 'alunos_consultados', 'professor', { total: dados.rowCount });
  res.json({ alunos: dados.rows.map(publico) }); 
});


app.post('/api/professor/perguntas', autenticar, permitir('professor'), async (req, res) => {
  const texto = String(req.body.texto || '').trim().slice(0, 500);
  const alternativas = Array.isArray(req.body.alternativas) 
    ? req.body.alternativas.map((item) => String(item || '').trim().slice(0, 200)) 
    : [];
  const respostaCorreta = Number(req.body.respostaCorreta);

  const nivel = ['Fácil', 'Médio', 'Difícil'].includes(req.body.nivel) 
    ? req.body.nivel 
    : 'Fácil';
  
  if (texto.length < 10) {
    return res.status(400).json({ mensagem: 'Escreva uma pergunta com pelo menos 10 caracteres.' });
  }
    
  if (alternativas.length !== 3 || alternativas.some((item) => !item)) {
    return res.status(400).json({ mensagem: 'Preencha as três alternativas.' });
  }
    
  if (req.body.respostaCorreta === '' || !Number.isInteger(respostaCorreta) || respostaCorreta < 0 || respostaCorreta > 2) {
    return res.status(400).json({ mensagem: 'Escolha a resposta correta.' });
  }
        
  const resultado = await banco.query(
    'INSERT INTO perguntas (texto, alternativas, resposta_correta, nivel, autor_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [texto, JSON.stringify(alternativas), respostaCorreta, nivel, req.usuario.id]
  );
  await registrarAuditoria(req, 'pergunta_criada', 'perguntas', { perguntaId: resultado.rows[0].id, nivel });
  
  res.status(201).json({ 
    mensagem: 'Pergunta enviada para aprovação do administrador.', 
    id: resultado.rows[0].id 
  });
});

app.get('/api/admin/perguntas', autenticar, permitir('admin'), async (req, res) => {
  const dados = await banco.query("SELECT p.id, p.texto, p.alternativas, p.resposta_correta, p.nivel, p.status, p.criado_em, CASE WHEN u.id IS NULL OR u.ativo = FALSE THEN 'Autor anonimizado' ELSE COALESCE(NULLIF(u.nome, ''), u.email) END AS nome, CASE WHEN u.ativo THEN u.email ELSE NULL END AS email FROM perguntas p LEFT JOIN usuarios u ON u.id = p.autor_id ORDER BY CASE p.status WHEN 'pendente' THEN 0 ELSE 1 END, p.criado_em DESC");
  await registrarAuditoria(req, 'perguntas_consultadas', 'admin', { total: dados.rowCount });
  res.json({ perguntas: dados.rows });
});

app.patch('/api/admin/perguntas/:id', autenticar, permitir('admin'), async (req, res) => {
  const status = req.body.status;
  
  if (!['aprovada', 'recusada'].includes(status)) { 
    return res.status(400).json({ mensagem: 'Status inválido.' }); 
  }
    
  const resultado = await banco.query("UPDATE perguntas SET status = $1, avaliada_por = $2, avaliada_em = NOW() WHERE id = $3 AND status = 'pendente' RETURNING id", [status, req.usuario.id, req.params.id]);
  
  if (!resultado.rowCount) {
    return res.status(404).json({ mensagem: 'Pergunta pendente não encontrada.' });
  }
  await registrarAuditoria(req, 'pergunta_avaliada', 'perguntas', { perguntaId: req.params.id, status });
          
  res.json({ mensagem: `Pergunta ${status === 'aprovada' ? 'aprovada' : 'recusada'} com sucesso.` });
});

app.get('/api/admin/solicitacoes-privacidade', autenticar, permitir('admin'), async (_req, res) => {
  try {
    const dados = await banco.query(
      `SELECT s.id, s.tipo, s.mensagem, s.status, s.criado_em,
              CASE WHEN u.id IS NULL OR u.ativo = FALSE THEN 'Conta anonimizada'
                   ELSE COALESCE(NULLIF(u.nome, ''), u.email) END AS solicitante
         FROM solicitacoes_privacidade s
         LEFT JOIN usuarios u ON u.id = s.usuario_id
        ORDER BY s.criado_em DESC
        LIMIT 100`
    );
    res.json({ solicitacoes: dados.rows });
  } catch (erro) {
    console.error('Erro ao consultar solicitações de privacidade:', erro.message);
    res.status(503).json({ mensagem: 'Não foi possível carregar as solicitações.' });
  }
});
app.get('/api/admin/auditoria', autenticar, permitir('admin'), async (req, res) => {
  const limite = Math.min(Math.max(Number(req.query.limite) || 50, 1), 200);
  const dados = await banco.query(
    `SELECT id, usuario_id, usuario_email, perfil, acao, recurso, detalhes, metodo, rota, ip, user_agent, criado_em
       FROM auditoria_acessos
      ORDER BY criado_em DESC
      LIMIT $1`,
    [limite]
  );
  res.json({ logs: dados.rows });
});

app.get('/api/jogo/perguntas', autenticar, permitir('aluno'), async (req, res) => {
  const nivel = ['Fácil', 'Médio', 'Difícil'].includes(req.query.nivel) ? req.query.nivel : null;
  const consulta = "SELECT id, texto, alternativas, resposta_correta FROM perguntas WHERE status = 'aprovada'" + (nivel ? ' AND nivel = $1' : '') + ' ORDER BY RANDOM() LIMIT 20';
  const dados = await banco.query(consulta, nivel ? [nivel] : []);
  await registrarAuditoria(req, 'jogo_iniciado', 'jogo', { nivel: nivel || 'todos', perguntas: dados.rowCount });
        
  res.json({ 
    perguntas: dados.rows.map((pergunta) => ({ 
      texto: pergunta.texto, 
      opcoes: typeof pergunta.alternativas === 'string' ? JSON.parse(pergunta.alternativas) : pergunta.alternativas, 
      certa: pergunta.resposta_correta 
    })) 
  });
});

app.post('/api/jogo/resultado', autenticar, permitir('aluno'), async (req, res) => {
  const acertos = Math.max(Number(req.body.acertos) || 0, 0);
  const erros = Math.max(Number(req.body.erros) || 0, 0);
  const nivel = ['Fácil', 'Médio', 'Difícil'].includes(req.body.nivel) ? req.body.nivel : 'Fácil';
  const modo = ['colega', 'computador'].includes(req.body.modo) ? req.body.modo : 'computador';
  const resultado = String(req.body.resultado || '').trim().slice(0, 80);

  await registrarAuditoria(req, 'jogo_finalizado', 'jogo', { acertos, erros, nivel, modo, resultado });
  res.status(204).end();
});

app.get('/', (_req, res) => res.sendFile(path.join(view, 'html', 'login.html')));
app.get('/home', pagina('home.html', 'aluno', 'professor'));
app.get('/termos', pagina('termos.html'));
app.get('/privacidade', pagina('privacidade.html'));
app.get('/alterar-senha', pagina('alterar-senha.html'));
app.get('/jogo', pagina('jogo.html', 'aluno'));
app.get('/admin', pagina('admin.html', 'admin'));

async function prepararBanco() {
  await banco.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE');
  await banco.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS encerrada_em TIMESTAMPTZ');
  await banco.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS termos_aceitos_em TIMESTAMPTZ');
  await banco.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS termos_versao VARCHAR(20)');
  await banco.query("CREATE TABLE IF NOT EXISTS solicitacoes_privacidade (id BIGSERIAL PRIMARY KEY, usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE, tipo VARCHAR(30) NOT NULL, mensagem TEXT NOT NULL DEFAULT '', status VARCHAR(20) NOT NULL DEFAULT 'recebida', criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  await banco.query('CREATE INDEX IF NOT EXISTS solicitacoes_privacidade_usuario_id_idx ON solicitacoes_privacidade(usuario_id)');
  await banco.query('ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_email_key');
  await banco.query('CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_ativo_idx ON usuarios(email) WHERE ativo = TRUE');  await banco.query("CREATE TABLE IF NOT EXISTS perguntas (id SERIAL PRIMARY KEY, texto VARCHAR(500) NOT NULL, alternativas JSONB NOT NULL, resposta_correta SMALLINT NOT NULL CHECK (resposta_correta BETWEEN 0 AND 2), nivel VARCHAR(10) NOT NULL DEFAULT 'Fácil', status VARCHAR(10) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'recusada')), autor_id UUID REFERENCES usuarios(id) ON DELETE SET NULL, avaliada_por UUID REFERENCES usuarios(id), criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), avaliada_em TIMESTAMPTZ)");
  await banco.query('ALTER TABLE perguntas ALTER COLUMN autor_id DROP NOT NULL');

  await banco.query("CREATE TABLE IF NOT EXISTS auditoria_acessos (id BIGSERIAL PRIMARY KEY, usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL, usuario_email VARCHAR(150), perfil VARCHAR(20), acao VARCHAR(80) NOT NULL, recurso VARCHAR(120) NOT NULL, detalhes JSONB NOT NULL DEFAULT '{}'::jsonb, metodo VARCHAR(10) NOT NULL, rota TEXT NOT NULL, ip VARCHAR(80), user_agent TEXT, criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  await banco.query('CREATE INDEX IF NOT EXISTS auditoria_acessos_criado_em_idx ON auditoria_acessos(criado_em DESC)');
  await banco.query('CREATE INDEX IF NOT EXISTS auditoria_acessos_usuario_id_idx ON auditoria_acessos(usuario_id)');
}

async function criarAdmin() {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_SENHA) return;

  const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
  let admin = await banco.query('SELECT id FROM usuarios WHERE email = $1 AND ativo = TRUE', [email]);

  if (!admin.rowCount) {
    admin = await banco.query(
      "INSERT INTO usuarios (email, senha_hash, perfil, nome) VALUES ($1, $2, 'admin', 'Administrador') RETURNING id",
      [email, await hash(process.env.ADMIN_SENHA)]
    );
  }

  await banco.query('UPDATE perguntas SET autor_id = $1 WHERE autor_id = $2', [admin.rows[0].id, AUTOR_SEMENTE_ID]);
  await banco.query('DELETE FROM usuarios WHERE id = $1', [AUTOR_SEMENTE_ID]);
}
prepararBanco()
  .then(criarAdmin)
  .then(() => 
    app.listen(process.env.PORT || 3000, () => 
      console.log('ConectaSaúde rodando em http://localhost:3000')
    )
  )
  .catch(erro => { 
    console.error('Erro ao preparar o banco de dados:', erro.message); 
    process.exit(1); 
  });
