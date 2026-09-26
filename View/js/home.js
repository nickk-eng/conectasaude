const areaAluno = document.querySelector('#area-aluno');

const areaProfessor = document.querySelector('#area-professor');
const tipoUsuario = document.querySelector('#tipo-usuario');
const tituloHome = document.querySelector('#titulo-home');
const telaPerfil = document.querySelector('#tela-perfil');
let usuarioAtual = null;



let nivelEscolhido = '';
async function iniciarPagina() {
  const resposta = await apiFetch('/api/auth/eu');
  if (!resposta.ok) return window.location.href = '/';
  const { usuario } = await resposta.json();
  usuarioAtual = usuario;
  preencherPerfil(usuario);
  tipoUsuario.textContent = `Olá, ${usuario.nome || usuario.email}!`;
  if (usuario.perfil === 'professor') {
    areaAluno.hidden = true;
    areaProfessor.hidden = false;
    tituloHome.textContent = 'Painel do professor';
    mostrarAlunos();
  }

}

function preencherPerfil(usuario) {
  const avatar = document.querySelector('#avatar-perfil');
  const nomeAvatar = usuario.nome || (usuario.perfil === 'professor' ? 'Professor' : 'Aluno');
  const parametrosAvatar = new URLSearchParams({
    name: nomeAvatar,
    size: '160',
    length: '2',
    rounded: 'true',
    background: '0D8ABC',
    color: 'FFFFFF',
    bold: 'true',
    format: 'png'
  });
  avatar.src = `https://ui-avatars.com/api/?${parametrosAvatar.toString()}`;
  avatar.alt = `Avatar com as iniciais de ${nomeAvatar}`;
  document.querySelector('#email-perfil').value = usuario.email || '';
  document.querySelector('#nome-perfil').value = usuario.nome || '';
  document.querySelector('#tipo-perfil').textContent = usuario.perfil;
  const aluno = usuario.perfil === 'aluno';
  document.querySelector('#label-turma-perfil').hidden = !aluno;
  document.querySelector('#turma-perfil').hidden = !aluno;
  document.querySelector('#turma-perfil').required = aluno;
  document.querySelector('#turma-perfil').value = aluno ? (usuario.turma || '') : '';
}

document.querySelector('#abrir-perfil').addEventListener('click', () => telaPerfil.showModal());
document.querySelector('#fechar-perfil').addEventListener('click', () => telaPerfil.close());
document.querySelector('#cancelar-perfil').addEventListener('click', () => telaPerfil.close());
telaPerfil.addEventListener('click', (evento) => { if (evento.target === telaPerfil) telaPerfil.close(); });
document.querySelector('#form-perfil').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const dados = new FormData(evento.currentTarget);
  const mensagemPerfil = document.querySelector('#mensagem-perfil');
  const botao = evento.currentTarget.querySelector('button[type="submit"]');
  botao.disabled = true;
  try {
    const resposta = await apiFetch('/api/usuario/perfil', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: dados.get('nome'), turma: dados.get('turma') })
    });
    const resultado = await resposta.json();
    if (!resposta.ok) throw new Error(resultado.mensagem || 'Não foi possível salvar o perfil.');
    usuarioAtual = resultado.usuario;
    preencherPerfil(usuarioAtual);
    tipoUsuario.textContent = `Olá, ${usuarioAtual.nome || usuarioAtual.email}!`;
    mensagemPerfil.textContent = 'Perfil atualizado com sucesso.';
    mensagemPerfil.className = 'mensagem sucesso';
  } catch (erro) {
    mensagemPerfil.textContent = erro.message || 'Não foi possível conectar ao servidor.';
    mensagemPerfil.className = 'mensagem erro';
  } finally {
    botao.disabled = false;
  }
});

async function mostrarAlunos() {
  const resposta = await apiFetch('/api/professor/alunos');
  const { alunos } = await resposta.json();
  const corpo = document.querySelector('#corpo-alunos');
  document.querySelector('#total-alunos').textContent = alunos.length;
  corpo.innerHTML = '';
  alunos.forEach((aluno) => {
    const linha = document.createElement('tr');
    [aluno.nome || 'Nome não informado', aluno.email, aluno.turma || 'Ainda não informado'].forEach((texto) => {
      const coluna = document.createElement('td');
      coluna.textContent = texto;
      linha.appendChild(coluna);
    });

    corpo.appendChild(linha);
  });
  document.querySelector('#sem-alunos').hidden = alunos.length > 0;
}
document.querySelectorAll('.dificuldade').forEach((botao) => botao.addEventListener('click', () => {
  nivelEscolhido = botao.dataset.nivel;
  document.querySelector('#mensagem-jogo').textContent = `Você escolheu o nível ${nivelEscolhido}. Agora escolha como jogar.`;
}));


document.querySelectorAll('.jogar').forEach((botao) => botao.addEventListener('click', () => {
  if (!nivelEscolhido) return document.querySelector('#mensagem-jogo').textContent = 'Escolha primeiro uma dificuldade.';
  window.location.href = `/jogo?nivel=${nivelEscolhido}&modo=${botao.dataset.modo}`;
}));

const formularioPergunta = document.querySelector('#formulario-pergunta');
const mensagemProfessor = document.querySelector('#mensagem-professor');
document.querySelector('#abrir-criar-pergunta')?.addEventListener('click', () => {
  formularioPergunta.hidden = false;
  mensagemProfessor.textContent = '';
  formularioPergunta.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.querySelector('#cancelar-pergunta')?.addEventListener('click', () => {
  formularioPergunta.hidden = true;
  document.querySelector('#criar-pergunta').reset();
});
document.querySelector('#criar-pergunta')?.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const formulario = new FormData(evento.currentTarget);
  const resposta = await apiFetch('/api/professor/perguntas', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto: formulario.get('texto'), alternativas: [formulario.get('alternativa1'), formulario.get('alternativa2'), formulario.get('alternativa3')], respostaCorreta: formulario.get('respostaCorreta'), nivel: formulario.get('nivel') })
  });
  const dados = await resposta.json();
  mensagemProfessor.textContent = dados.mensagem;
  mensagemProfessor.className = `mensagem ${resposta.ok ? 'sucesso' : 'erro'}`;
  if (resposta.ok) { evento.currentTarget.reset(); formularioPergunta.hidden = true; }
});


document.querySelector('#form-encerrar-conta').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const senha = new FormData(evento.currentTarget).get('senha');
  if (!window.confirm('Tem certeza que deseja encerrar sua conta? O acesso será bloqueado.')) return;

  const mensagemConta = document.querySelector('#mensagem-conta');
  const botao = evento.currentTarget.querySelector('button[type="submit"]');
  botao.disabled = true;
  try {
    const resposta = await apiFetch('/api/auth/encerrar-conta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senha })
    });
    const resultado = await resposta.json();
    mensagemConta.textContent = resultado.mensagem || 'Não foi possível encerrar a conta.';
    mensagemConta.className = `mensagem ${resposta.ok ? 'sucesso' : 'erro'}`;
    if (resposta.ok) {
      removerToken();
      window.setTimeout(() => { telaPerfil.close(); window.location.href = '/'; }, 1200);
    } else {
      botao.disabled = false;
    }
  } catch {
    mensagemConta.textContent = 'Não foi possível conectar ao servidor.';
    mensagemConta.className = 'mensagem erro';
    botao.disabled = false;
  }
});
document.querySelector('#sair').addEventListener('click', async () => {
  try {
    await apiFetch('/api/auth/sair', { method: 'POST' });
  } finally {
  removerToken();
  }
  window.location.href = '/';
});
iniciarPagina();
