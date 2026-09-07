const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const banco = new Pool({ connectionString: process.env.DATABASE_URL });
const view = path.join(__dirname, 'View');
app.use(express.json());
app.use('/css', express.static(path.join(view, 'css')));
app.use('/js', express.static(path.join(view, 'js')));
app.use('/img', express.static(path.join(__dirname, 'img')));

function cookies(req) { return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(item => { const [k, ...v] = item.trim().split('='); return [k, decodeURIComponent(v.join('='))]; })); }
function hash(senha, salt = crypto.randomBytes(16).toString('hex')) { return new Promise((ok, erro) => crypto.scrypt(senha, salt, 64, (e, valor) => e ? erro(e) : ok(`${salt}:${valor.toString('hex')}`))); }
async function confereSenha(senha, salva) { const [salt] = salva.split(':'); return crypto.timingSafeEqual(Buffer.from(await hash(senha, salt)), Buffer.from(salva)); }
function publico(usuario) { return { id: usuario.id, email: usuario.email, nome: usuario.nome, perfil: usuario.perfil, turma: usuario.turma }; }

async function usuarioLogado(req) {
  const token = cookies(req).conectaSaudeSession;
  if (!token) return null;
  const resultado = await banco.query('SELECT u.id, u.email, u.nome, u.perfil, u.turma FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id WHERE s.id = $1 AND s.expira_em > NOW()', [token]);
  return resultado.rows[0] || null;
}
async function autenticar(req, res, next) { const usuario = await usuarioLogado(req); if (!usuario) return res.status(401).json({ mensagem: 'Faça login para continuar.' }); req.usuario = usuario; next(); }
function permitir(...perfis) { return (req, res, next) => perfis.includes(req.usuario.perfil) ? next() : res.status(403).json({ mensagem: 'Você não tem acesso a esta área.' }); }
function pagina(arquivo, ...perfis) { return async (req, res) => { const usuario = await usuarioLogado(req); if (!usuario) return res.redirect('/'); if (!perfis.includes(usuario.perfil)) return res.redirect('/home'); res.sendFile(path.join(view, 'html', arquivo)); }; }

app.post('/api/auth/cadastro', async (req, res) => {
  const { email, senha, confirmarSenha, perfil } = req.body;
  const emailLimpo = String(email || '').trim().toLowerCase();
  if (!emailLimpo || !senha || senha.length < 6) return res.status(400).json({ mensagem: 'Informe um e-mail e senha de ao menos 6 caracteres.' });
  if (senha !== confirmarSenha) return res.status(400).json({ mensagem: 'As senhas não são iguais.' });
  if (!['aluno', 'professor'].includes(perfil)) return res.status(400).json({ mensagem: 'Escolha aluno ou professor.' });
  try { await banco.query('INSERT INTO usuarios (email, senha_hash, perfil) VALUES ($1, $2, $3)', [emailLimpo, await hash(senha), perfil]); res.status(201).json({ mensagem: 'Conta criada. Agora você pode entrar.' }); }
  catch (erro) {
    if (erro.code === '23505') return res.status(409).json({ mensagem: 'Já existe uma conta com este e-mail.' });
    console.error('Erro ao criar conta:', erro.message);
    res.status(503).json({ mensagem: 'Não foi possível acessar o banco de dados. Configure o arquivo .env e tente novamente.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const usuario = (await banco.query('SELECT * FROM usuarios WHERE email = $1', [String(req.body.email || '').trim().toLowerCase()])).rows[0];
  if (!usuario || !(await confereSenha(req.body.senha || '', usuario.senha_hash))) return res.status(401).json({ mensagem: 'E-mail ou senha inválidos.' });
  const token = crypto.randomUUID();
  await banco.query("INSERT INTO sessoes (id, usuario_id, expira_em) VALUES ($1, $2, NOW() + INTERVAL '8 hours')", [token, usuario.id]);
  res.setHeader('Set-Cookie', `conectaSaudeSession=${encodeURIComponent(token)}; Max-Age=28800; Path=/; HttpOnly; SameSite=Strict`);
  res.json({ usuario: publico(usuario) });
});

app.post('/api/auth/sair', async (req, res) => { await banco.query('DELETE FROM sessoes WHERE id = $1', [cookies(req).conectaSaudeSession]); res.setHeader('Set-Cookie', 'conectaSaudeSession=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict'); res.status(204).end(); });
app.get('/api/auth/eu', autenticar, (req, res) => res.json({ usuario: publico(req.usuario) }));
app.put('/api/aluno/perfil', autenticar, permitir('aluno'), async (req, res) => { const nome = String(req.body.nome || '').trim().slice(0, 60); const turma = String(req.body.turma || '').trim().slice(0, 60); if (!turma) return res.status(400).json({ mensagem: 'Informe a turma.' }); const resultado = await banco.query('UPDATE usuarios SET nome = $1, turma = $2 WHERE id = $3 RETURNING id, email, nome, perfil, turma', [nome, turma, req.usuario.id]); res.json({ usuario: publico(resultado.rows[0]) }); });
app.get('/api/professor/alunos', autenticar, permitir('professor', 'admin'), async (_req, res) => { const dados = await banco.query("SELECT id, email, nome, perfil, turma FROM usuarios WHERE perfil = 'aluno' ORDER BY nome, email"); res.json({ alunos: dados.rows.map(publico) }); });
app.get('/api/admin/usuarios', autenticar, permitir('admin'), async (_req, res) => { const dados = await banco.query('SELECT id, email, nome, perfil, turma FROM usuarios ORDER BY criado_em DESC'); res.json({ usuarios: dados.rows.map(publico) }); });

app.get('/', (_req, res) => res.sendFile(path.join(view, 'html', 'login.html')));
app.get('/home', pagina('home.html', 'aluno', 'professor'));
app.get('/jogo', pagina('jogo.html', 'aluno'));
app.get('/admin', pagina('admin.html', 'admin'));

async function criarAdmin() { if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_SENHA) return; const email = process.env.ADMIN_EMAIL.trim().toLowerCase(); const existe = await banco.query('SELECT id FROM usuarios WHERE email = $1', [email]); if (!existe.rowCount) await banco.query("INSERT INTO usuarios (email, senha_hash, perfil, nome) VALUES ($1, $2, 'admin', 'Administrador')", [email, await hash(process.env.ADMIN_SENHA)]); }
criarAdmin().then(() => app.listen(process.env.PORT || 3000, () => console.log('ConectaSaúde rodando em http://localhost:3000'))).catch(erro => { console.error('Erro ao conectar no PostgreSQL:', erro.message); process.exit(1); });
