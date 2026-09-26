const formCadastro = document.querySelector('#form-cadastro');
const formLogin = document.querySelector('#form-login');
const mensagem = document.querySelector('#mensagem');
const abaEntrar = document.querySelector('#entrar');

function mostrarMensagem(texto, tipo = '') {
  mensagem.textContent = texto;
  mensagem.className = `mensagem ${tipo}`;
}

function emailNormalizado(valor) {
  return valor.trim().toLowerCase();
}

document.querySelectorAll('.botao-olho').forEach((botao) => {
  botao.addEventListener('click', () => {
    const campo = document.getElementById(botao.dataset.campo);
    const mostrar = campo.type === 'password';
    campo.type = mostrar ? 'text' : 'password';
    botao.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
    botao.setAttribute('title', mostrar ? 'Ocultar senha' : 'Mostrar senha');
    botao.classList.toggle('senha-visivel', mostrar);
  });
});


formCadastro.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mostrarMensagem('');
  const dados = new FormData(formCadastro);
  const email = emailNormalizado(dados.get('email'));
  const senha = dados.get('password');
  const confirmarSenha = dados.get('confirm_password');

  if (senha.length < 8 || !/[A-Z]/.test(senha) || !/[0-9]/.test(senha) || !/[^A-Za-z0-9]/.test(senha)) {
    return mostrarMensagem('A senha precisa ter pelo menos 8 caracteres, uma letra maiúscula, um número e um caractere especial.', 'erro');
  }
  if (senha !== confirmarSenha) return mostrarMensagem('As senhas não são iguais.', 'erro');

  try {
    const resposta = await fetch('/api/auth/cadastro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha, confirmarSenha, perfil: dados.get('tipo_usuario'), aceitouTermos: dados.get('aceitar_termos') === 'on' })
    });
    const resultado = await resposta.json();
    mostrarMensagem(resultado.mensagem || (resposta.ok ? 'Conta criada.' : 'Não foi possível criar a conta.'), resposta.ok ? 'sucesso' : 'erro');
    if (resposta.ok) {
      formCadastro.reset();
      abaEntrar.checked = true;
      document.querySelector('#email-login').value = email;
    }
  } catch {
    mostrarMensagem('Não foi possível conectar ao servidor.', 'erro');
  }
});

formLogin.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mostrarMensagem('');
  const dados = new FormData(formLogin);
  try {
    const resposta = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailNormalizado(dados.get('email')), senha: dados.get('password') })
    });
    const resultado = await resposta.json();
    if (!resposta.ok) return mostrarMensagem(resultado.mensagem || 'Não foi possível entrar.', 'erro');
    salvarToken(resultado.token);
    window.location.href = resultado.usuario.perfil === 'admin' ? '/admin' : '/home';
  } catch {
    mostrarMensagem('Não foi possível conectar ao servidor.', 'erro');
  }
});
