const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const banco = require('../Config/banco');
const senha = require('../Service/senhaService');
const email = require('../Service/emailService');
const service = require('../Service/recuperacaoSenhaService');
test('recuperação exige código válido, limita tentativas e invalida sessões', async () => {
  let desafio, alterada = false, sessoesRemovidas = false, enviados = 0, existe = true;
  banco.connect = async () => ({ release() {}, async query(sql, params) {
    if (sql.startsWith('SELECT u.id')) return { rows: existe && desafio && !desafio.expirado && desafio.token_hash === params[0] ? [{id:'u',email:'teste@example.com'}] : [] };
    if (sql.startsWith('SELECT id')) return { rows: existe ? [{id:'u',email:'teste@example.com'}] : [] };
    if (sql.startsWith('SELECT 1')) return {rowCount: desafio ? 1 : 0};
    if (sql.startsWith('INSERT INTO recuperacoes')) { desafio={id:params[0],codigo_hash:params[2],tentativas:0}; }
    if (sql.startsWith('SELECT *')) return {rows: desafio && !desafio.expirado && desafio.tentativas < 5 ? [desafio] : []};
    if (sql.startsWith('UPDATE recuperacoes_senha SET tentativas')) desafio.tentativas++;
    if (sql.includes("SET codigo_hash = ''")) { desafio.token_hash=params[0]; desafio.codigo_hash=''; }
    if (sql.startsWith('UPDATE usuarios')) { assert.ok(await senha.conferir('NovaSenha1!', params[0])); alterada=true; }
    if (sql.startsWith('DELETE FROM recuperacoes')) desafio=null;
    if (sql.startsWith('DELETE FROM sessoes')) sessoesRemovidas=true;
    return {rows:[]};
  }});
  let codigo;
  email.enviarCodigo = async (destino, valor) => { assert.equal(destino,'teste@example.com'); codigo=valor; enviados++; };
  await service.solicitar('teste@example.com');
  assert.match(codigo,/^\d{6}$/); assert.notEqual(desafio.codigo_hash,codigo);
  await service.solicitar('teste@example.com'); assert.equal(enviados,1);
  const errado = codigo === '000000' ? '111111' : '000000';
  assert.equal(await service.verificarCodigo('teste@example.com',errado),null);
  assert.equal(alterada,false); assert.equal(desafio.tentativas,1);
  const token = await service.verificarCodigo('teste@example.com',codigo);
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(desafio.token_hash, createHash('sha256').update(token).digest('hex'));
  assert.equal(alterada, false);
  assert.equal(await service.verificarCodigo('teste@example.com',codigo),null);
  assert.equal(await service.redefinir('0'.repeat(64),'NovaSenha1!'),null);
  assert.ok(await service.redefinir(token,'NovaSenha1!'));
  assert.ok(alterada && sessoesRemovidas);
  assert.equal(await service.redefinir(token,'NovaSenha1!'),null);
  await service.solicitar('teste@example.com'); desafio.expirado=true;
  assert.equal(await service.verificarCodigo('teste@example.com',codigo),null);
  desafio.expirado=false; desafio.tentativas=5;
  assert.equal(await service.verificarCodigo('teste@example.com',codigo),null);
  existe=false; await service.solicitar('teste@example.com'); assert.equal(enviados,2);
});
test('rota antiga rejeita troca sem código', async () => {
  const app=require('../app'); const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  try {
    const resposta=await fetch('http://127.0.0.1:'+server.address().port+'/api/auth/recuperar-senha',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'teste@example.com',novaSenha:'NovaSenha1!',confirmarSenha:'NovaSenha1!'})});
    assert.equal(resposta.status,400);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
