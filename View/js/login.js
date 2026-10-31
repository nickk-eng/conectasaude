const formCadastro = document.querySelector('#form-cadastro');
const formLogin = document.querySelector('#form-login');
const formConfirmacaoTotp = document.querySelector('#form-confirmacao-totp');
const mensagem = document.querySelector('#mensagem');
const abaEntrar = document.querySelector('#entrar');
let desafioMfaId = '';

function atualizarAnoCadastro() {
  const aluno = formCadastro.querySelector('[name="tipo_usuario"]:checked')?.value === 'aluno';
  const campo = document.querySelector('#ano-cadastro');
  document.querySelector('#ano-cadastro-area').hidden = !aluno;
  campo.disabled = !aluno;
  campo.required = aluno;
  if (!aluno) campo.value = '';
}

formCadastro.querySelectorAll('[name="tipo_usuario"]').forEach(campo => {
  campo.addEventListener('change', atualizarAnoCadastro);
});
atualizarAnoCadastro();

function mostrarMensagem(texto, tipo = '') {
  mensagem.textContent = texto;
  mensagem.className = `mensagem ${tipo}`;
}

function emailNormalizado(valor) {
  return valor.trim().toLowerCase();
}

function voltarParaLogin() {
  formConfirmacaoTotp.hidden = true;
  formLogin.hidden = false;
  document.querySelector('#codigo-totp').value = '';
  document.querySelector('#area-qr-totp').hidden = true;
  document.querySelector('#qr-code-totp').src = '';
  document.querySelector('#chave-manual-totp').textContent = '';
  desafioMfaId = '';
  mostrarMensagem('');
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
      body: JSON.stringify({ email, senha, confirmarSenha, perfil: dados.get('tipo_usuario'), turma: dados.get('turma'), aceitouTermos: dados.get('aceitar_termos') === 'on' })
    });
    const resultado = await resposta.json();
    mostrarMensagem(resultado.mensagem || (resposta.ok ? 'Conta criada.' : 'Não foi possível criar a conta.'), resposta.ok ? 'sucesso' : 'erro');
    if (resposta.ok) {
      formCadastro.reset();
      atualizarAnoCadastro();
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
    const email = emailNormalizado(dados.get('email'));
    const resposta = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha: dados.get('password') })
    });
    const resultado = await resposta.json();
    if (!resposta.ok) return mostrarMensagem(resultado.mensagem || 'Não foi possível entrar.', 'erro');
    if (resultado.mfaRequerida) {
      desafioMfaId = resultado.desafioId;
      formLogin.hidden = true;
      document.querySelector('#titulo-mfa').textContent = resultado.configuracaoMfa ? 'Configure seu autenticador' : 'Confirme seu acesso';
      document.querySelector('#instrucao-mfa').textContent = resultado.mensagem;
      document.querySelector('#area-qr-totp').hidden = !resultado.configuracaoMfa;
      document.querySelector('#qr-code-totp').src = resultado.qrCode || '';
      document.querySelector('#chave-manual-totp').textContent = resultado.chaveManual || '';
      formConfirmacaoTotp.hidden = false;
      document.querySelector('#codigo-totp').focus();
      return mostrarMensagem(resultado.mensagem, 'sucesso');
    }
    salvarToken(resultado.token);
    window.location.href = resultado.usuario.perfil === 'admin' ? '/admin' : '/home';
  } catch {
    mostrarMensagem('Não foi possível conectar ao servidor.', 'erro');
  }
});

formConfirmacaoTotp.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  mostrarMensagem('');
  const codigo = document.querySelector('#codigo-totp').value.replace(/\D/g, '');
  try {
    const resposta = await fetch('/api/auth/verificar-totp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ desafioId: desafioMfaId, codigo })
    });
    const resultado = await resposta.json();
    if (!resposta.ok) return mostrarMensagem(resultado.mensagem || 'Não foi possível confirmar o código.', 'erro');
    salvarToken(resultado.token);
    window.location.href = resultado.usuario.perfil === 'admin' ? '/admin' : '/home';
  } catch {
    mostrarMensagem('Não foi possível conectar ao servidor.', 'erro');
  }
});

document.querySelector('#voltar-login').addEventListener('click', voltarParaLogin);

document.querySelector('#cadastrar').addEventListener('change', () => {
  if (document.querySelector('#cadastrar').checked) voltarParaLogin();
});
