const tipo = new URLSearchParams(window.location.search).get('tipo');
if (!['pre', 'pos'].includes(tipo)) window.location.href = '/home';

const TEXTOS = {
  pre: {
    chip: 'Pré-teste',
    titulo: 'Antes de jogar: pré-teste',
    texto: 'Vamos descobrir o que você já sabe sobre o tema. São poucas perguntas e não valem nota.'
  },
  pos: {
    chip: 'Pós-teste',
    titulo: 'Agora é a hora do pós-teste',
    texto: 'Você jogou e aprendeu bastante! Responda de novo as mesmas perguntas do pré-teste para ver o quanto evoluiu.'
  }
};

const secoes = ['carregando', 'introducao', 'questao', 'resultado', 'erro'];
let perguntas = [];
let respostas = [];
let indice = 0;

function mostrar(nome) {
  secoes.forEach((id) => document.querySelector('#' + id).classList.toggle('escondido', id !== nome));
  document.querySelector('#chip-progresso').classList.toggle('escondido', nome !== 'questao');
}

function mostrarErro(mensagem) {
  document.querySelector('#texto-erro').textContent = mensagem;
  mostrar('erro');
}

async function carregar() {
  document.querySelector('#chip-tipo').textContent = TEXTOS[tipo].chip;

  const resposta = await apiFetch(`/api/avaliacao/${tipo}`);
  if (resposta.status === 401) return (window.location.href = '/');

  const dados = await resposta.json().catch(() => ({}));

  if (resposta.status === 403 && dados.codigo === 'PRE_TESTE_PENDENTE') {
    return (window.location.href = '/avaliacao?tipo=pre');
  }
  if (!resposta.ok) return mostrarErro(dados.mensagem || 'Tente novamente em instantes.');
  if (dados.concluida) return mostrarResultado(dados, true);

  perguntas = dados.perguntas;
  respostas = Array(perguntas.length).fill(null);
  document.querySelector('#titulo-introducao').textContent = TEXTOS[tipo].titulo;
  document.querySelector('#texto-introducao').textContent = TEXTOS[tipo].texto;
  mostrar('introducao');
}

function desenharPergunta() {
  const pergunta = perguntas[indice];
  const ultima = indice === perguntas.length - 1;

  document.querySelector('#chip-progresso').textContent = `${indice + 1} de ${perguntas.length}`;
  document.querySelector('#barra-preenchida').style.width = `${(indice / perguntas.length) * 100}%`;
  document.querySelector('#numero-pergunta').textContent = `Pergunta ${indice + 1}`;
  document.querySelector('#pergunta').textContent = pergunta.texto;
  document.querySelector('#aviso').textContent = '';
  document.querySelector('#anterior').disabled = indice === 0;
  document.querySelector('#proxima').textContent = ultima ? 'Finalizar' : 'Próxima';

  const alternativas = document.querySelector('#alternativas');
  alternativas.innerHTML = '';
  pergunta.opcoes.forEach((texto, posicao) => {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.textContent = texto;
    botao.classList.toggle('selecionada', respostas[indice] === posicao);
    botao.addEventListener('click', () => {
      respostas[indice] = posicao;
      document.querySelector('#aviso').textContent = '';
      alternativas.querySelectorAll('button').forEach((b, i) => b.classList.toggle('selecionada', i === posicao));
    });
    alternativas.appendChild(botao);
  });
}

async function enviar() {
  const botao = document.querySelector('#proxima');
  botao.disabled = true;
  try {
    const resposta = await apiFetch(`/api/avaliacao/${tipo}/respostas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        respostas: perguntas.map((pergunta, i) => ({ perguntaId: pergunta.id, resposta: respostas[i] }))
      })
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      document.querySelector('#aviso').textContent = dados.mensagem || 'Não foi possível enviar suas respostas.';
      return;
    }
    mostrarResultado(dados, false);
  } catch {
    document.querySelector('#aviso').textContent = 'Não foi possível conectar ao servidor.';
  } finally {
    botao.disabled = false;
  }
}

function formatarNota(nota) {
  return `${nota.acertos}/${nota.total} (${nota.percentual}%)`;
}

function mostrarResultado(dados, jaFeita) {
  const ehPos = dados.tipo === 'pos';
  document.querySelector('#titulo-resultado').textContent = `${TEXTOS[dados.tipo].chip} ${jaFeita ? 'já realizado' : 'concluído'}`;

  if (!ehPos) {
    document.querySelector('#texto-resultado').textContent =
      `Você acertou ${dados.acertos} de ${dados.total} perguntas (${dados.percentual}%). Agora é só jogar! Depois de algumas partidas você poderá fazer o pós-teste.`;
    document.querySelector('#link-seguir').textContent = 'Ir para o jogo';
  } else {
    const ganho = dados.evolucao;
    document.querySelector('#texto-resultado').textContent = ganho > 0
      ? 'Parabéns! Você aprendeu mais e melhorou o seu resultado.'
      : ganho === 0
        ? 'Você manteve o seu resultado. Continue praticando!'
        : 'O resultado ficou abaixo do pré-teste. Que tal jogar mais um pouco e revisar o conteúdo?';
    document.querySelector('#nota-pre').textContent = formatarNota(dados.pre);
    document.querySelector('#nota-pos').textContent = formatarNota(dados);
    document.querySelector('#nota-evolucao').textContent = `${ganho > 0 ? '+' : ''}${ganho} p.p.`;
    document.querySelector('#comparacao').classList.remove('escondido');
  }

  if (dados.revisao) desenharRevisao(dados.revisao);
  mostrar('resultado');
}

function desenharRevisao(revisao) {
  const lista = document.querySelector('#lista-revisao');
  lista.innerHTML = '';
  revisao.forEach((item) => {
    const acertou = item.escolhida === item.correta;
    const linha = document.createElement('li');

    const enunciado = document.createElement('strong');
    enunciado.textContent = item.texto;
    linha.appendChild(enunciado);

    const sua = document.createElement('div');
    sua.className = acertou ? 'certo' : 'errado';
    sua.textContent = `Sua resposta: ${item.opcoes[item.escolhida]}`;
    linha.appendChild(sua);

    if (!acertou) {
      const certa = document.createElement('div');
      certa.className = 'certo';
      certa.textContent = `Resposta correta: ${item.opcoes[item.correta]}`;
      linha.appendChild(certa);
    }
    lista.appendChild(linha);
  });
  document.querySelector('#revisao').classList.remove('escondido');
}

document.querySelector('#comecar').addEventListener('click', () => {
  indice = 0;
  mostrar('questao');
  desenharPergunta();
});

document.querySelector('#anterior').addEventListener('click', () => {
  if (indice > 0) { indice--; desenharPergunta(); }
});

document.querySelector('#proxima').addEventListener('click', () => {
  if (respostas[indice] === null) {
    document.querySelector('#aviso').textContent = 'Escolha uma alternativa para continuar.';
    return;
  }
  if (indice < perguntas.length - 1) { indice++; desenharPergunta(); return; }
  enviar();
});

carregar().catch(() => mostrarErro('Não foi possível conectar ao servidor.'));
