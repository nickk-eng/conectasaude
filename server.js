const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const app = express();
const banco = new Pool({ connectionString: process.env.DATABASE_URL });
const view = path.join(__dirname, 'View');

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

async function usuarioLogado(req) {
  const [tipo, token] = String(req.get('Authorization') || '').trim().split(/\s+/, 2);
  if (tipo !== 'Bearer' || !token) return null;
  
    const resultado = await banco.query('SELECT u.id, u.email, u.nome, u.perfil, u.turma FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id WHERE s.id = $1 AND s.expira_em > NOW()', [token]);
    return resultado.rows[0] || null;
}

async function autenticar(req, res, next) { 
   const usuario = await usuarioLogado(req); 
   if (!usuario) 
        return res.status(401).json({ mensagem: 'Faça login para continuar.' }); 
        
   req.usuario = usuario; 
   next(); 
}

function permitir(...perfis) { 
  return (req, res, next) => 
    perfis.includes(req.usuario.perfil) ? next() : res.status(403).json({ mensagem: 'Você não tem acesso a esta área.' }); 
}

function pagina(arquivo) { 
  return (_req, res) => res.sendFile(path.join(view, 'html', arquivo));
}

app.post('/api/auth/cadastro', async (req, res) => {
    const { email, senha, confirmarSenha, perfil } = req.body;
      const emailLimpo = String(email || '').trim().toLowerCase();
    
    if (!emailLimpo || !senha || senha.length < 6) {
        return res.status(400).json({ mensagem: 'Informe um e-mail e senha de ao menos 6 caracteres.' });
    }
      if (senha !== confirmarSenha) 
          return res.status(400).json({ mensagem: 'As senhas não são iguais.' });
          
        if (!['aluno', 'professor'].includes(perfil)) 
            return res.status(400).json({ mensagem: 'Escolha aluno ou professor.' });
            
    try { 
      await banco.query('INSERT INTO usuarios (email, senha_hash, perfil) VALUES ($1, $2, $3)', [emailLimpo, await hash(senha), perfil]); 
      res.status(201).json({ mensagem: 'Conta criada. Agora você pode entrar.' }); 
    }
    catch (erro) 
    {
      if (erro.code === '23505') 
        return res.status(409).json({ mensagem: 'Já existe uma conta com este e-mail.' });
      
        console.error('Erro ao criar conta:', erro.message);
        res.status(503).json({ mensagem: 'Não foi possível acessar o banco de dados. Configure o arquivo .env e tente novamente.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
  const usuario = (await banco.query('SELECT * FROM usuarios WHERE email = $1', [String(req.body.email || '').trim().toLowerCase()])).rows[0];
  
    if (!usuario || !(await confereSenha(req.body.senha || '', usuario.senha_hash))) 
      return res.status(401).json({ mensagem: 'E-mail ou senha inválidos.' });
      
    const sessao = await banco.query("INSERT INTO sessoes (id, usuario_id, expira_em) VALUES (gen_random_uuid(), $1, NOW() + INTERVAL '8 hours') RETURNING id", [usuario.id]);
    const token = sessao.rows[0].id;
    res.json({ usuario: publico(usuario), token });
});

app.post('/api/auth/sair', autenticar, async (req, res) => { 
  const [, token] = String(req.get('Authorization') || '').trim().split(/\s+/, 2);
  await banco.query('DELETE FROM sessoes WHERE id = $1', [token]);
  res.status(204).end(); 
});

app.get('/api/auth/eu', autenticar, (req, res) => res.json({
   usuario: publico(req.usuario) 
}));

app.put('/api/aluno/perfil', autenticar, permitir('aluno'), async (req, res) => { 
  const nome = String(req.body.nome || '').trim().slice(0, 60); 
  const turma = String(req.body.turma || '').trim().slice(0, 60); 
    
    if (!turma) 
      return res.status(400).json({ mensagem: 'Informe a turma.' }); 
      
      const resultado = await banco.query('UPDATE usuarios SET nome = $1, turma = $2 WHERE id = $3 RETURNING id, email, nome, perfil, turma', [nome, turma, req.usuario.id]); 
      res.json({ 
        usuario: publico(resultado.rows[0])
      }); 
});

app.get('/api/professor/alunos', autenticar, permitir('professor', 'admin'), async (_req, res) => { 
  const dados = await banco.query("SELECT id, email, nome, perfil, turma FROM usuarios WHERE perfil = 'aluno' ORDER BY nome, email"); 
    res.json({ alunos: dados.rows.map(publico) }); 
});

app.get('/api/admin/usuarios', autenticar, permitir('admin'), async (_req, res) => { 
  const dados = await banco.query('SELECT id, email, nome, perfil, turma FROM usuarios ORDER BY criado_em DESC');
   res.json({ usuarios: dados.rows.map(publico) 
 }); 
});

app.post('/api/professor/perguntas', autenticar, permitir('professor'), async (req, res) => {
  const texto = String(req.body.texto || '').trim().slice(0, 500);
  const alternativas = Array.isArray(req.body.alternativas) ? req.body.alternativas.map((item) => String(item || '').trim().slice(0, 200)) : [];
  const respostaCorreta = Number(req.body.respostaCorreta);

  const nivel = ['Fácil', 'Médio', 'Difícil'].includes(req.body.nivel) ? req.body.nivel : 'Fácil';
  
  if (texto.length < 10) 
    return res.status(400).json({ mensagem: 'Escreva uma pergunta com pelo menos 10 caracteres.' });
    
    if (alternativas.length !== 3 || alternativas.some((item) => !item)) 
      return res.status(400).json({ mensagem: 'Preencha as três alternativas.' });
      
      if (req.body.respostaCorreta === '' || !Number.isInteger(respostaCorreta) || respostaCorreta < 0 || respostaCorreta > 2) 
        return res.status(400).json({ mensagem: 'Escolha a resposta correta.' });
        
  const resultado = await banco.query(
    'INSERT INTO perguntas (texto, alternativas, resposta_correta, nivel, autor_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [texto, JSON.stringify(alternativas), respostaCorreta, nivel, req.usuario.id]
  );
  
    res.status(201).json({ mensagem: 'Pergunta enviada para aprovação do administrador.', id: resultado.rows[0].id });
});

app.get('/api/admin/perguntas', autenticar, permitir('admin'), async (_req, res) => {
  const dados = await banco.query("SELECT p.id, p.texto, p.alternativas, p.resposta_correta, p.nivel, p.status, p.criado_em, u.nome, u.email FROM perguntas p JOIN usuarios u ON u.id = p.autor_id ORDER BY CASE p.status WHEN 'pendente' THEN 0 ELSE 1 END, p.criado_em DESC");
    res.json({ perguntas: dados.rows });
});

app.patch('/api/admin/perguntas/:id', autenticar, permitir('admin'), async (req, res) => {
  const status = req.body.status;
  
  if (!['aprovada', 'recusada'].includes(status)) { return res.status(400).json({ mensagem: 'Status inválido.' }); }
    
  const resultado = await banco.query("UPDATE perguntas SET status = $1, avaliada_por = $2, avaliada_em = NOW() WHERE id = $3 AND status = 'pendente' RETURNING id", [status, req.usuario.id, req.params.id]);
  if (!resultado.rowCount) 
    return res.status(404).json({ mensagem: 'Pergunta pendente não encontrada.' });
          
    res.json({ mensagem: `Pergunta ${status === 'aprovada' ? 'aprovada' : 'recusada'} com sucesso.` });
});

app.get('/api/jogo/perguntas', autenticar, permitir('aluno'), async (req, res) => {
  const nivel = ['Fácil', 'Médio', 'Difícil'].includes(req.query.nivel) ? req.query.nivel : null;
  const consulta = "SELECT id, texto, alternativas, resposta_correta FROM perguntas WHERE status = 'aprovada'" + (nivel ? ' AND nivel = $1' : '') + ' ORDER BY RANDOM() LIMIT 20';
  const dados = await banco.query(consulta, nivel ? [nivel] : []);
        
    res.json({ perguntas: dados.rows.map((pergunta) => ({ texto: pergunta.texto, opcoes: typeof pergunta.alternativas === 'string' ? JSON.parse(pergunta.alternativas) : pergunta.alternativas, certa: pergunta.resposta_correta })) });
});

app.get('/', (_req, res) => res.sendFile(path.join(view, 'html', 'login.html')));
app.get('/home', pagina('home.html', 'aluno', 'professor'));
app.get('/jogo', pagina('jogo.html', 'aluno'));
app.get('/admin', pagina('admin.html', 'admin'));

async function prepararBanco() {
  await banco.query("CREATE TABLE IF NOT EXISTS perguntas (id SERIAL PRIMARY KEY, texto VARCHAR(500) NOT NULL, alternativas JSONB NOT NULL, resposta_correta SMALLINT NOT NULL CHECK (resposta_correta BETWEEN 0 AND 2), nivel VARCHAR(10) NOT NULL DEFAULT 'Fácil', status VARCHAR(10) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'recusada')), autor_id UUID NOT NULL REFERENCES usuarios(id), avaliada_por UUID REFERENCES usuarios(id), criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), avaliada_em TIMESTAMPTZ)");
}

async function criarAdmin() { 
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_SENHA) 
    return; 
  
  const email = process.env.ADMIN_EMAIL.trim().toLowerCase(); 
  const existe = await banco.query('SELECT id FROM usuarios WHERE email = $1', [email]); 
    
      if (!existe.rowCount) {
        await banco.query("INSERT INTO usuarios (email, senha_hash, perfil, nome) VALUES ($1, $2, 'admin', 'Administrador')", [email, await hash(process.env.ADMIN_SENHA)]); 
      }
}

prepararBanco()
  .then(criarAdmin)
    .then(() => 
    app.listen(process.env.PORT || 3000, () => 
    console.log('ConectaSaúde rodando em http://localhost:3000')))
    .catch(erro => { 
    console.error('Erro ao preparar o banco de dados:', erro.message); 
    process.exit(1); 
          });
