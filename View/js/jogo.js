const parametros = new URLSearchParams(window.location.search);
const nivel = parametros.get('nivel') || 'Fácil';
const modo = parametros.get('modo') || 'computador';

let perguntas = [];
let perguntasDisponiveis = [];
let indicePergunta = 0;
let tabuleiro = Array(9).fill('');
let jogador = 'x';
let acertos = 0;
let erros = 0;
let podeJogar = false;
let respostaEncerrada = false;
let tempo;

async function carregarPerguntasAprovadas() {

  const resposta = await apiFetch(
    '/api/jogo/perguntas?nivel=' + encodeURIComponent(nivel)
  );

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(
      dados.mensagem ||
      'Não foi possível carregar as perguntas.'
    );
  }

  perguntas = Array.isArray(dados.perguntas)
    ? dados.perguntas
    : [];

  perguntasDisponiveis = [...perguntas];

  embaralharPerguntas();

  indicePergunta = 0;
}
 
function embaralharPerguntas() {

  for (
    let i = perguntasDisponiveis.length - 1;
    i > 0;
    i--
  ) {

    const j =
      Math.floor(Math.random() * (i + 1));

    [
      perguntasDisponiveis[i],
      perguntasDisponiveis[j]
    ] =
    [
      perguntasDisponiveis[j],
      perguntasDisponiveis[i]
    ];
  }
}

document.querySelector('#nivel').textContent =
  `Nível: ${nivel}`;

document.querySelector('#modo').textContent =
  modo === 'colega'
    ? 'Modo: colega'
    : 'Modo: computador';

document.querySelector('#form-inicio').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const ano =
      document.querySelector('#ano').value;
    const nome =
      document.querySelector('#nome').value.trim();
    const resposta =
      await salvarPerfilAluno(ano, nome);
    if (!resposta.ok) {
      return alert(
        'Não foi possível salvar seus dados. Tente novamente.'
      );
}

    document.querySelector('#ano-escolar').textContent =
      ano;
    document
      .querySelector('#ano-escolar')
      .classList.remove('escondido');
    document
      .querySelector('#inicio')
      .classList.add('escondido');
    document
      .querySelector('#partida')
      .classList.remove('escondido');
    document.querySelector('#vez').textContent =
      'Responda a pergunta para começar a jogar.';
    try {
      await carregarPerguntasAprovadas();
      if (!perguntas.length) {
        return mostrarAvisoSemPerguntas();
      }
      mostrarPergunta();
}

    catch (erro) {
      mostrarAvisoSemPerguntas(
        erro.message
      );
    }
  });

function salvarPerfilAluno(turma, nome) {
  return apiFetch('/api/aluno/perfil', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      turma,
      nome
    })
  });
}

function mostrarPergunta() {
  if (!perguntasDisponiveis.length) {
    return mostrarAvisoSemPerguntas();
  }
  if (
    indicePergunta >= perguntasDisponiveis.length
  ) {
    embaralharPerguntas();
    indicePergunta = 0;
}

  const pergunta =
    perguntasDisponiveis[indicePergunta];
  const alternativas =
    document.querySelector('#alternativas');
  podeJogar = false;
  respostaEncerrada = false;
  document.querySelector('#retorno').textContent ='';
  document.querySelector('#pergunta').textContent =pergunta.texto;
  alternativas.innerHTML = '';
  pergunta.opcoes.forEach((opcao, indice) => {

    const botao =
      document.createElement('button');
    botao.type = 'button';
    botao.textContent = opcao;
    botao.addEventListener(
      'click',
      () => responder(
        indice,
        pergunta.certa
      )
    );
    alternativas.appendChild(botao);
  });

  iniciarTempo();
}

function mostrarAvisoSemPerguntas(
  mensagem = `Ainda não há perguntas aprovadas ${nivel}.`
) {

  clearInterval(tempo);
  document.querySelector('#pergunta').textContent =
    mensagem;
  document.querySelector('#alternativas').innerHTML =
    '';
  document.querySelector('#tempo').textContent =
    'Aguardando perguntas';
  document.querySelector('#vez').textContent =
    'A partida começará quando houver perguntas disponíveis.';
    const retorno =
    document.querySelector('#retorno');
  retorno.textContent =
    'Peça ao professor para enviar perguntas e aguarde a aprovação.';
  retorno.className =
    'retorno errado';
}

function iniciarTempo() {
  let segundos =
    nivel === 'Difícil'
      ? 10
      : nivel === 'Médio'
        ? 15
        : 20;
  clearInterval(tempo);
  document.querySelector('#tempo').textContent =
    `Tempo: ${segundos}s`;
  tempo = setInterval(() => {
    segundos--;
    document.querySelector('#tempo').textContent =
      `Tempo: ${segundos}s`;
    if (segundos === 0) {
      clearInterval(tempo);
      respostaEncerrada = true;
      document
        .querySelectorAll('#alternativas button')
        .forEach((botao) => {
          botao.disabled = true;
        });
      erros++;

      atualizarPlacar();
      document.querySelector('#retorno').textContent =
        'O tempo acabou. A vez passou.';
      document.querySelector('#retorno').className =
        'retorno errado';
      if (
        modo === 'computador' &&
        jogador === 'x'
      ) {
        setTimeout(
          jogadaComputador,
          1200
        );
      }

      else {
        setTimeout(
          passarVez,
          1200
        );
      }
    }
  }, 1000);
}

function responder(resposta, certa) {
  if (respostaEncerrada) {
    return;
  }

  respostaEncerrada = true;
  clearInterval(tempo);
  const botoes =
    document.querySelectorAll(
      '#alternativas button'
    );
  botoes.forEach((botao, indice) => {
    botao.disabled = true;
    if (indice === certa) {
      botao.classList.add('correta');
    }
  });

  const retorno =
    document.querySelector('#retorno');
  if (resposta === certa) {
    acertos++;
    podeJogar = true;
    retorno.textContent =
      'Resposta correta! Escolha uma casa vazia no tabuleiro.';
    retorno.className =
      'retorno certo';
    liberarCasas();
  }

  else {
    erros++;
    botoes[resposta]
      .classList
      .add('errada');
    retorno.textContent =
      'Resposta incorreta. A vez passou.';
    retorno.className =
      'retorno errado';
    if (
      modo === 'computador' &&
      jogador === 'x'
    ) {

      setTimeout(
        jogadaComputador,
        1200
      );
    }

    else {
      setTimeout(
        passarVez,
        1200
      );
    }
  }
  atualizarPlacar();
}

function liberarCasas() {
  document
    .querySelectorAll('.tabuleiro button')
    .forEach((casa, indice) => {

      if (!tabuleiro[indice]) {

        casa.disabled = false;
        casa.classList.add('liberada');

      }
    });
}

document.querySelectorAll('.tabuleiro button').forEach((casa, indice) => {
    casa.addEventListener(
      'click',
      () => jogar(indice)
    );
  });


function jogar(indice) {
  if (
    !podeJogar ||
    tabuleiro[indice]
  ) {
    return;
  }
  tabuleiro[indice] =
    jogador;
  atualizarTabuleiro();
  if (verificarFim()) {
    return;
  }
  if (
    modo === 'computador' &&
    jogador === 'x'
  ) {

    podeJogar = false;
    document.querySelector('#vez').textContent =
      'O computador está escolhendo uma casa.';
    setTimeout(
      jogadaComputador,
      600
    );
    return;
  }
  passarVez();
}

function passarVez() {
  jogador =
    jogador === 'x'
      ? 'o'
      : 'x';
  podeJogar = false;

  document.querySelector('#vez').textContent =
    `Agora é a vez do jogador ${jogador.toUpperCase()}.`;
  indicePergunta++;
  setTimeout(
    mostrarPergunta,
    500
  );

}

function jogadaComputador() {
  const casaEscolhida =
    getJogadaComputador(
      tabuleiro,
      nivel
    );
  if (casaEscolhida === null) {
    return;
  }
  jogador = 'o';
  tabuleiro[casaEscolhida] =
    jogador;
  atualizarTabuleiro();
  if (verificarFim()) {
    return;
  }

  jogador = 'x';
  podeJogar = false;
  document.querySelector('#vez').textContent =
    'Sua vez. Responda à pergunta para jogar.';
  indicePergunta++;

  setTimeout(
    mostrarPergunta,
    500
  );
}

function atualizarTabuleiro() {
  document
    .querySelectorAll('.tabuleiro button')
    .forEach((casa, indice) => {
      casa.textContent =
        tabuleiro[indice].toUpperCase();
      casa.dataset.jogador =
        tabuleiro[indice];
      casa.disabled = true;
      casa.classList.remove(
        'liberada'
      );
    });
}

function verificarFim() {
  const vitoria =
    verificarVencedor(tabuleiro);
  if (vitoria) {
    vitoria.linha.forEach((indice) => {
      document
        .querySelectorAll(
          '.tabuleiro button'
        )[indice]
        .classList
        .add('vencedora');
    });

    finalizar(
      'Jogador ' +
      vitoria.vencedor.toUpperCase() +
      ' venceu!'
    );

    return true;
  }
  if (
    tabuleiro.every(
      (casa) => casa !== ''
    )
  ) {
    finalizar(
      'Deu velha!'
    );
    return true;
  }
  return false;
}


const LINHAS_VENCEDORAS = [

  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],

  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],

  [0, 4, 8],
  [2, 4, 6]

];

function verificarVencedor(t) {
  for (
    const linha of LINHAS_VENCEDORAS
  ) {
    const [a, b, c] =
      linha;
    if (
      t[a] &&
      t[a] === t[b] &&
      t[b] === t[c]
    ) {
      return {
        vencedor: t[a],
        linha
      };
    }
  }
  return null;
}

function casasDisponiveis(t) {
  return t
    .map(
      (c, i) => c ? null : i
    )
    .filter(
      (i) => i !== null
    );
}

function encontrarJogadaVencedora(
  t,
  simbolo
) {
  for (
    const i of casasDisponiveis(t)
  ) {
    const tentativa =
      [...t];
    tentativa[i] =
      simbolo;
    if (
      verificarVencedor(tentativa)
        ?.vencedor === simbolo
    ) {
      return i;
    }
  }
  return null;
}

function getJogadaComputador(
  t,
  n
) {
  const disponiveis =
    casasDisponiveis(t);
  if (!disponiveis.length) {
    return null;
  }
  const acuracia = {
    'Fácil': 0.25,

    'Médio': 0.50,

    'Difícil': 0.80
  }[n] || 0.50;

  const usarHeuristica =
    Math.random() < acuracia;
  if (usarHeuristica) {

    const vitoria =
      encontrarJogadaVencedora(
        t,
        'o'
      );
    if (vitoria !== null) {

      return vitoria;
    }

    const bloqueio =
      encontrarJogadaVencedora(
        t,
        'x'
      );

    if (bloqueio !== null) {

      return bloqueio;
    }

    if (!t[4]) {

      return 4;
    }

    const cantos = [
      0,
      2,
      6,
      8
    ].filter(
      (i) => !t[i]
    );

    if (cantos.length) {
      return cantos[
        Math.floor(
          Math.random() *
          cantos.length
        )
      ];
    }
  }

  return disponiveis[
    Math.floor(
      Math.random() *
      disponiveis.length
    )
  ];

}

function atualizarPlacar() {
  document.querySelector('#acertos').textContent =
    acertos
  document.querySelector('#erros').textContent =
    erros;
}

function finalizar(titulo) {

  clearInterval(tempo);
  document
    .querySelector('#partida')
    .classList
    .add('escondido');
  document
    .querySelector('#fim')
    .classList
    .remove('escondido');
  document.querySelector('#titulo-final').textContent =
    titulo;
  document.querySelector('#texto-final').textContent =
    `Você acertou ${acertos} pergunta(s) e errou ${erros}.`;
}

document
  .querySelector('#novamente')
  .addEventListener(
    'click',
    () => window.location.reload()
  );
