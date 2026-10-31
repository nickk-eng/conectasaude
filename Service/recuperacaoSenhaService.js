const { randomInt, randomUUID, randomBytes, createHash } = require('node:crypto');
const banco = require('../Config/banco');
const senhaService = require('./senhaService');
const emailService = require('./emailService');

async function solicitar(email) {
  const cliente = await banco.connect();
  let envio;
  try {
    await cliente.query('BEGIN');
    const { rows } = await cliente.query('SELECT id FROM usuarios WHERE email = $1 AND ativo = TRUE FOR UPDATE', [email]);
    if (rows[0]) {
      const usuarioId = rows[0].id;
      const anterior = await cliente.query("SELECT 1 FROM recuperacoes_senha WHERE usuario_id = $1 AND criado_em > NOW() - INTERVAL '1 minute'", [usuarioId]);
      if (!anterior.rowCount) {
        const codigo = String(randomInt(0, 1000000)).padStart(6, '0');
        const id = randomUUID();
        await cliente.query('DELETE FROM recuperacoes_senha WHERE usuario_id = $1', [usuarioId]);
        await cliente.query("INSERT INTO recuperacoes_senha (id, usuario_id, codigo_hash, expira_em) VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')", [id, usuarioId, await senhaService.gerarHash(codigo)]);
        envio = { id, codigo };
      }
    }
    await cliente.query('COMMIT');
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
  if (envio) {
    try {
      await emailService.enviarCodigo(email, envio.codigo);
    } catch (erro) {
      await banco.query('DELETE FROM recuperacoes_senha WHERE id = $1', [envio.id]);
      // A resposta pública permanece igual para não revelar contas cadastradas.
      console.error('Falha no envio do código de recuperação:', erro.code || 'SMTP indisponível');
    }
  }
}

async function verificarCodigo(email, codigo) {
  const cliente = await banco.connect();
  try {
    await cliente.query('BEGIN');
    const usuario = await cliente.query('SELECT id, email, perfil FROM usuarios WHERE email = $1 AND ativo = TRUE FOR UPDATE', [email]);
    const conta = usuario.rows[0];
    const resultado = conta ? await cliente.query('SELECT * FROM recuperacoes_senha WHERE usuario_id = $1 AND expira_em > NOW() AND tentativas < 5 FOR UPDATE', [conta.id]) : { rows: [] };
    const desafio = resultado.rows[0];
    if (!desafio || desafio.token_hash) {
      await cliente.query('COMMIT');
      return null;
    }
    await cliente.query('UPDATE recuperacoes_senha SET tentativas = tentativas + 1 WHERE id = $1', [desafio.id]);
    if (!(await senhaService.conferir(codigo, desafio.codigo_hash))) {
      await cliente.query('COMMIT');
      return null;
    }
    const token = randomBytes(32).toString('hex');
    await cliente.query("UPDATE recuperacoes_senha SET codigo_hash = '', token_hash = $1 WHERE id = $2", [hashToken(token), desafio.id]);
    await cliente.query('COMMIT');
    return token;
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}
async function redefinir(token, novaSenha) {
  const cliente = await banco.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await cliente.query(
      'SELECT u.id, u.email, u.perfil FROM usuarios u JOIN recuperacoes_senha r ON r.usuario_id = u.id WHERE r.token_hash = $1 AND r.expira_em > NOW() AND u.ativo = TRUE FOR UPDATE OF u, r',
      [hashToken(token)]
    );
    const conta = resultado.rows[0];
    if (!conta) { await cliente.query('COMMIT'); return null; }
    await cliente.query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [await senhaService.gerarHash(novaSenha), conta.id]);
    await cliente.query('DELETE FROM recuperacoes_senha WHERE usuario_id = $1', [conta.id]);
    await cliente.query('DELETE FROM sessoes WHERE usuario_id = $1', [conta.id]);
    await cliente.query('DELETE FROM desafios_mfa WHERE usuario_id = $1', [conta.id]);
    await cliente.query('COMMIT');
    return conta;
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally { cliente.release(); }
}
module.exports = { solicitar, verificarCodigo, redefinir };
