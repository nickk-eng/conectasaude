const areaAluno = document.querySelector('#area-aluno');

const areaProfessor = document.querySelector('#area-professor');
const tipoUsuario = document.querySelector('#tipo-usuario');
const tituloHome = document.querySelector('#titulo-home');


let nivelEscolhido = '';
async function iniciarPagina() {
  const resposta = await apiFetch('/api/auth/eu');
  if (!resposta.ok) return window.location.href = '/';
  const { usuario } = await resposta.json();
  tipoUsuario.textContent = `Olá, ${usuario.email}!`;
  if (usuario.perfil === 'professor') {
    areaAluno.hidden = true;
    areaProfessor.hidden = false;
    tituloHome.textContent = 'Painel do professor';
    mostrarAlunos();
  }

}
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

document.querySelector('#sair').addEventListener('click', async () => {
  try {
    await apiFetch('/api/auth/sair', { method: 'POST' });
  } finally {
  removerToken();
  }
  window.location.href = '/';
});
iniciarPagina();
