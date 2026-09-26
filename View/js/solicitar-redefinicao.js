const formularioRecuperacao = document.querySelector('#form-recuperar-senha');
const mensagemRecuperacao = document.querySelector('#mensagem-recuperacao');

formularioRecuperacao.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const dados = new FormData(formularioRecuperacao);
  const email = String(dados.get('email') || '').trim().toLowerCase();
  const novaSenha = String(dados.get('novaSenha') || '');
  const confirmarSenha = String(dados.get('confirmarSenha') || '');
  if (novaSenha.length < 8) {
    mensagemRecuperacao.textContent = 'A senha precisa ter pelo menos 8 caracteres.';
    mensagemRecuperacao.className = 'mensagem erro';
    return;
  }
  if (novaSenha !== confirmarSenha) {
    mensagemRecuperacao.textContent = 'As senhas não são iguais.';
    mensagemRecuperacao.className = 'mensagem erro';
    return;
  }

  const botao = formularioRecuperacao.querySelector('button[type="submit"]');
  botao.disabled = true;
  try {
    const resposta = await fetch('/api/auth/recuperar-senha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, novaSenha, confirmarSenha })
    });
    const resultado = await resposta.json();
    mensagemRecuperacao.textContent = resultado.mensagem || 'Não foi possível redefinir a senha.';
    mensagemRecuperacao.className = `mensagem ${resposta.ok ? 'sucesso' : 'erro'}`;
    if (resposta.ok) formularioRecuperacao.reset();
  } catch {
    mensagemRecuperacao.textContent = 'Não foi possível conectar ao servidor.';
    mensagemRecuperacao.className = 'mensagem erro';
  } finally {
    botao.disabled = false;
  }
});