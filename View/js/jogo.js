const parametros = new URLSearchParams(window.location.search);
const nivel = parametros.get('nivel') || 'Fácil';
const modo = parametros.get('modo') || 'computador';
const perguntas = [
  { texto: 'Qual bebida é mais importante para manter o corpo hidratado?', opcoes: ['Refrigerante', 'Água', 'Energético'], certa: 1 },
  { texto: 'Dormir bem ajuda principalmente em quê?', opcoes: ['Na memória e no descanso', 'Em ficar acordado o dia todo', 'Em substituir a alimentação'], certa: 0 },
  { texto: 'Qual hábito ajuda a cuidar da saúde mental?', opcoes: ['Guardar todos os problemas', 'Conversar com alguém de confiança', 'Não descansar'], certa: 1 },
  { texto: 'Antes de comer, o que devemos fazer?', opcoes: ['Lavar as mãos', 'Usar o celular', 'Pular a refeição'], certa: 0 },
  { texto: 'Praticar atividade física regularmente pode ajudar a:', opcoes: ['Ter mais disposição', 'Nunca precisar dormir', 'Substituir a água'], certa: 0 }
];
let tabuleiro = Array(9).fill('');
let jogador = 'x';
let acertos = 0;
let erros = 0;
let perguntaAtual = 0;
let podeJogar = false;
let respostaEncerrada = false;
let tempo;

document.querySelector('#nivel').textContent = `Nível: ${nivel}`;
document.querySelector('#modo').textContent = modo === 'colega' ? 'Modo: colega' : 'Modo: computador';

document.querySelector('#form-inicio').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const ano = document.querySelector('#ano').value;
  const nome = document.querySelector('#nome').value.trim();
  const resposta = await salvarPerfilAluno(ano, nome);
  if (!resposta.ok) return alert('Não foi possível salvar seus dados. Tente novamente.');
  document.querySelector('#ano-escolar').textContent = ano;
  document.querySelector('#ano-escolar').classList.remove('escondido');
  document.querySelector('#inicio').classList.add('escondido');
  document.querySelector('#partida').classList.remove('escondido');
  document.querySelector('#vez').textContent = 'Responda à pergunta para liberar a sua jogada.';
  mostrarPergunta();
});

function salvarPerfilAluno(turma, nome) {
  return fetch('/api/aluno/perfil', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ turma, nome })
  });
}

function mostrarPergunta() {
  const pergunta = perguntas[perguntaAtual % perguntas.length];
  const alternativas = document.querySelector('#alternativas');
  podeJogar = false;
  respostaEncerrada = false;
  document.querySelector('#retorno').textContent = '';
  document.querySelector('#pergunta').textContent = pergunta.texto;
  alternativas.innerHTML = '';
  pergunta.opcoes.forEach((opcao, indice) => {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.textContent = opcao;
    botao.addEventListener('click', () => responder(indice, pergunta.certa));
    alternativas.appendChild(botao);
  });
  iniciarTempo();
}

function iniciarTempo() {
  let segundos = nivel === 'Difícil' ? 10 : nivel === 'Médio' ? 15 : 20;
  clearInterval(tempo);
  document.querySelector('#tempo').textContent = `Tempo: ${segundos}s`;
  tempo = setInterval(() => {
    segundos--;
    document.querySelector('#tempo').textContent = `Tempo: ${segundos}s`;
    if (segundos === 0) {
      clearInterval(tempo);
      respostaEncerrada = true;
      document.querySelectorAll('#alternativas button').forEach((botao) => botao.disabled = true);
      erros++;
      atualizarPlacar();
      document.querySelector('#retorno').textContent = 'O tempo acabou. A vez passou.';
      document.querySelector('#retorno').className = 'retorno errado';
      setTimeout(proximaPergunta, 1200);
    }
  }, 1000);
}

function responder(resposta, certa) {
  if (respostaEncerrada) return;
  respostaEncerrada = true;
  clearInterval(tempo);
  const botoes = document.querySelectorAll('#alternativas button');
  botoes.forEach((botao, indice) => {
    botao.disabled = true;
    if (indice === certa) botao.classList.add('correta');
  });
  const retorno = document.querySelector('#retorno');
  if (resposta === certa) {
    acertos++;
    podeJogar = true;
    retorno.textContent = 'Resposta correta! Escolha uma casa vazia no tabuleiro.';
    retorno.className = 'retorno certo';
    liberarCasas();
  } else {
    erros++;
    botoes[resposta].classList.add('errada');
    retorno.textContent = 'Resposta incorreta. A vez passou.';
    retorno.className = 'retorno errado';
    setTimeout(proximaPergunta, 1200);
  }
  atualizarPlacar();
}

function liberarCasas() {
  document.querySelectorAll('.tabuleiro button').forEach((casa, indice) => {
    if (!tabuleiro[indice]) {
      casa.disabled = false;
      casa.classList.add('liberada');
    }
  });
}

document.querySelectorAll('.tabuleiro button').forEach((casa, indice) => {
  casa.addEventListener('click', () => jogar(indice));
});

function jogar(indice) {
  if (!podeJogar || tabuleiro[indice]) return;
  tabuleiro[indice] = jogador;
  atualizarTabuleiro();
  if (verificarFim()) return;

  if (modo === 'computador' && jogador === 'x') {
    document.querySelector('#vez').textContent = 'O computador está escolhendo uma casa.';
    setTimeout(jogadaComputador, 600);
    return;
  }

  jogador = jogador === 'x' ? 'o' : 'x';
  podeJogar = false;
  document.querySelector('#vez').textContent = `Agora é a vez do jogador ${jogador.toUpperCase()}.`;
  setTimeout(mostrarPergunta, 500);
}

function jogadaComputador() {
  const casasVazias = tabuleiro.map((valor, indice) => valor ? null : indice).filter((indice) => indice !== null);
  const casaEscolhida = casasVazias[Math.floor(Math.random() * casasVazias.length)];
  jogador = 'o';
  tabuleiro[casaEscolhida] = jogador;
  atualizarTabuleiro();
  if (verificarFim()) return;
  jogador = 'x';
  document.querySelector('#vez').textContent = 'Sua vez. Responda à pergunta para jogar.';
  setTimeout(mostrarPergunta, 500);
}

function atualizarTabuleiro() {
  document.querySelectorAll('.tabuleiro button').forEach((casa, indice) => {
    casa.textContent = tabuleiro[indice].toUpperCase();
    casa.dataset.jogador = tabuleiro[indice];
    casa.disabled = true;
    casa.classList.remove('liberada');
  });
}

function verificarFim() {
  const linhas = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const ganhou = linhas.some((linha) => linha.every((indice) => tabuleiro[indice] === jogador));
  if (ganhou) { finalizar(`Jogador ${jogador.toUpperCase()} venceu!`); return true; }
  if (!tabuleiro.includes('')) { finalizar('Deu velha!'); return true; }
  return false;
}

function atualizarPlacar() { document.querySelector('#acertos').textContent = acertos; document.querySelector('#erros').textContent = erros; }
function proximaPergunta() { perguntaAtual++; mostrarPergunta(); }
function finalizar(titulo) {
  clearInterval(tempo);
  document.querySelector('#partida').classList.add('escondido');
  document.querySelector('#fim').classList.remove('escondido');
  document.querySelector('#titulo-final').textContent = titulo;
  document.querySelector('#texto-final').textContent = `Você acertou ${acertos} pergunta(s) e errou ${erros}.`;
}
document.querySelector('#novamente').addEventListener('click', () => window.location.reload());