const formCadastro = document.querySelector('#form-cadastro');
const formLogin = document.querySelector('#form-login');
const mensagem = document.querySelector('#mensagem');
const abaEntrar = document.querySelector('#entrar');


function mostrarMensagem(texto, tipo = '') {
  mensagem.textContent = texto;
  mensagem.className = `mensagem ${tipo}`;
}

formCadastro.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  try {
    const dados = new FormData(formCadastro);
    const resposta = await fetch('/api/auth/cadastro', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: dados.get('email').trim().toLowerCase(), senha: dados.get('password'),
        confirmarSenha: dados.get('confirm_password'), perfil: dados.get('tipo_usuario')
      })

    });

    const resultado = await resposta.json();
    mostrarMensagem(resultado.mensagem || 'Não foi possível cria  conta.', resposta.ok ? 'sucesso' : 'erro');
    if (resposta.ok) { formCadastro.reset(); abaEntrar.checked = true; }
  } catch (_erro) {
    mostrarMensagem('Não foi possível conectar ao servidor.', 'erro');
  }
});


formLogin.addEventListener('submit', async (evento) =>{
  evento.preventDefault();
  const dados = new FormData(formLogin);
  const resposta = await fetch('/api/auth/login',{
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: dados.get('email').trim().toLowerCase(), senha: dados.get('password') })
  });
  
  const resultado = await resposta.json();
  if (!resposta.ok) return mostrarMensagem(resultado.mensagem, 'erro');
  salvarToken(resultado.token);
  window.location.href = resultado.usuario.perfil === 'admin' ? '/admin' : '/home';
});
