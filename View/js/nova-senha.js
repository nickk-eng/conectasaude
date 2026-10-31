const token = sessionStorage.getItem('recuperacaoSenhaToken');
if (!token) window.location.replace('/alterar-senha');
const formulario = document.querySelector('#form-nova-senha');
const mensagem = document.querySelector('#mensagem-recuperacao');
formulario.addEventListener('submit', async evento => {
  evento.preventDefault();
  const dados = Object.fromEntries(new FormData(formulario));
  mensagem.className = 'mensagem erro';
  if (dados.novaSenha !== dados.confirmarSenha) { mensagem.textContent = 'As senhas não são iguais.'; return; }
  const botao = formulario.querySelector('button');
  botao.disabled = true;
  try {
    const resposta = await fetch('/api/auth/recuperar-senha', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...dados, token }) });
    const resultado = await resposta.json();
    if (!resposta.ok) { mensagem.textContent = resultado.mensagem; return; }
    sessionStorage.removeItem('recuperacaoSenhaToken');
    window.location.replace('/');
  } catch { mensagem.textContent = 'Não foi possível conectar ao servidor. Tente novamente.'; }
  finally { botao.disabled = false; }
});
