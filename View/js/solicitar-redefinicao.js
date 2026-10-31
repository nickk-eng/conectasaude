const formularioEnvio = document.querySelector('#form-solicitar-codigo');
const formularioCodigo = document.querySelector('#form-verificar-codigo');
const mensagem = document.querySelector('#mensagem-recuperacao');
const email = formularioEnvio.elements.email;
const botaoEnvio = formularioEnvio.querySelector('button');
let intervalo;
let ocupado = false;
function mostrar(texto, sucesso = false) {
  mensagem.textContent = texto;
  mensagem.className = 'mensagem ' + (sucesso ? 'sucesso' : 'erro');
}
async function enviar(url, dados) {
  const resposta = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
  const resultado = await resposta.json();
  if (!resposta.ok) throw new Error(resultado.mensagem || 'Não foi possível concluir.');
  return resultado;
}
email.addEventListener('input', () => {
  clearInterval(intervalo);
  botaoEnvio.disabled = ocupado;
  botaoEnvio.textContent = 'Enviar código';
  formularioCodigo.reset();
  mostrar('');
});
formularioEnvio.addEventListener('submit', async evento => {
  evento.preventDefault();
  if (ocupado) return;
  ocupado = true;
  botaoEnvio.disabled = true;
  email.readOnly = true;
  mostrar('Solicitando código…', true);
  try {
    const resultado = await enviar('/api/auth/solicitar-recuperacao', { email: email.value.trim().toLowerCase() });
    mostrar(resultado.mensagem, true);
    formularioCodigo.elements.codigo.focus();
    let segundos = 60;
    botaoEnvio.textContent = 'Reenviar código (' + segundos + 's)';
    clearInterval(intervalo);
    intervalo = setInterval(() => {
      segundos--;
      botaoEnvio.textContent = segundos > 0 ? 'Reenviar código (' + segundos + 's)' : 'Reenviar código';
      if (segundos <= 0) { clearInterval(intervalo); botaoEnvio.disabled = false; }
    }, 1000);
  } catch (erro) { mostrar(erro.message || 'Não foi possível conectar ao servidor.'); botaoEnvio.disabled = false; }
  finally { ocupado = false; email.readOnly = false; }
});
formularioCodigo.addEventListener('submit', async evento => {
  evento.preventDefault();
  if (!formularioEnvio.reportValidity()) return;
  const botao = formularioCodigo.querySelector('button');
  botao.disabled = true;
  try {
    const resultado = await enviar('/api/auth/verificar-codigo-recuperacao', { email: email.value.trim().toLowerCase(), codigo: formularioCodigo.elements.codigo.value.trim() });
    sessionStorage.setItem('recuperacaoSenhaToken', resultado.token);
    window.location.assign('/nova-senha');
  } catch (erro) { mostrar(erro.message || 'Não foi possível conectar ao servidor.'); }
  finally { botao.disabled = false; }
});
