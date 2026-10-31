const codigo = (new URLSearchParams(window.location.search).get('codigo') || sessionStorage.getItem('conectaSaudeSala') || '').toUpperCase();
let estado = null;
let ocupado = false;
let encerrado = false;
let ultimaVersao = -1;
const selecionar = (id) => document.getElementById(id);

function renderizar(sala) {
  estado = sala;
  selecionar('codigo-sala').textContent = `Código: ${sala.codigo}`;
  selecionar('nivel-sala').textContent = `Dificuldade: ${sala.nivel}`;
  const categorias = { 'hiv-aids': 'HIV e aids', sifilis: 'Sífilis', gonorreia: 'Gonorreia', clamidia: 'Clamídia', hpv: 'HPV', 'herpes-genital': 'Herpes genital', 'hepatites-virais': 'Hepatites virais', tricomoniase: 'Tricomoníase', 'prevencao-geral': 'Prevenção geral' };
  selecionar('categoria-sala').textContent = `Tema: ${categorias[sala.categoriaIst] || 'Todos os temas'}`;
  selecionar('jogadores-sala').textContent = sala.jogadores.map((p) => `${p.simbolo}: ${p.nome}${p.simbolo === sala.seuSimbolo ? ' (você)' : ''}`).join('\n');
  selecionar('status-sala').textContent = sala.status === 'aguardando'
    ? sala.jogadores.length < 2 ? 'Compartilhe o código. Aguardando outro aluno…' : 'Dois alunos conectados. O criador pode iniciar a partida.'
    : sala.mensagem;
  selecionar('iniciar-sala').hidden = !(sala.status === 'aguardando' && sala.criador);
  selecionar('iniciar-sala').disabled = sala.jogadores.length < 2;
  selecionar('partida-sala').hidden = sala.status === 'aguardando';
  selecionar('fim-sala').hidden = sala.status !== 'finalizada' || !sala.salva;
  selecionar('resultado-sala').textContent = sala.resultado;
  selecionar('vez-sala').textContent = sala.status === 'finalizada' ? 'Partida encerrada.' : sala.suaVez ? 'Sua vez!' : `Vez de ${sala.vez}. Aguarde o outro aluno.`;
  selecionar('tempo-sala').textContent = sala.status === 'jogando' ? `Tempo: ${sala.segundos}s` : '';
  selecionar('placar-sala').textContent = sala.jogadores.map((p) => `${p.nome} (${p.simbolo}): ${p.acertos} acerto(s), ${p.erros} erro(s)`).join('\n');
  selecionar('sair-sala').textContent = sala.status === 'jogando' ? 'Desistir da partida' : 'Sair da sala';
  document.querySelectorAll('#tabuleiro-sala button').forEach((botao, i) => {
    botao.textContent = sala.tabuleiro[i];
    botao.dataset.jogador = sala.tabuleiro[i].toLowerCase();
    botao.disabled = !(sala.suaVez && sala.fase === 'jogada' && !sala.tabuleiro[i]);
    botao.classList.toggle('liberada', !botao.disabled);
  });
  if (ultimaVersao !== sala.versao) {
    ultimaVersao = sala.versao;
    selecionar('pergunta-sala').textContent = sala.pergunta?.texto || (sala.status === 'finalizada' ? 'Confira o resultado da partida.' : sala.suaVez && sala.fase === 'jogada' ? 'Escolha uma casa vazia no tabuleiro.' : 'Aguardando o outro aluno.');
    selecionar('alternativas-sala').replaceChildren();
    sala.pergunta?.alternativas.forEach((texto, resposta) => {
      const botao = document.createElement('button');
      botao.type = 'button'; botao.textContent = texto;
      botao.addEventListener('click', () => agir('responder', { resposta }));
      selecionar('alternativas-sala').appendChild(botao);
    });
  }
  if (sala.status === 'finalizada' && sala.salva) {
    encerrado = true;
    sessionStorage.removeItem('conectaSaudeSala');
  }
}

async function requisitar(url, dados) {
  const resposta = await apiFetch(url, dados ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) } : {});
  const corpo = await resposta.json();
  if (!resposta.ok) {
    if ([401, 403, 404].includes(resposta.status)) {
      encerrado = true;
      sessionStorage.removeItem('conectaSaudeSala');
    }
    throw new Error(corpo.mensagem || 'Não foi possível atualizar a sala.');
  }
  return corpo;
}

async function atualizar() {
  if (ocupado || encerrado) return;
  ocupado = true;
  try {
    renderizar(await requisitar(`/api/salas/${encodeURIComponent(codigo)}${estado ? `?partida=${encodeURIComponent(estado.id)}` : ''}`));
    selecionar('erro-sala').textContent = '';
  } catch (erro) {
    selecionar('erro-sala').textContent = erro.message || 'Conexão interrompida. Tentando reconectar…';
    document.querySelectorAll('#tabuleiro-sala button, #alternativas-sala button, #iniciar-sala').forEach((b) => { b.disabled = true; });
    ultimaVersao = -1;
  } finally {
    ocupado = false;
  }
}

async function agir(acao, dados = {}) {
  if (ocupado || !estado) return;
  ocupado = true;
  document.querySelectorAll('#tabuleiro-sala button, #alternativas-sala button, #iniciar-sala, #sair-sala').forEach((b) => { b.disabled = true; });
  try {
    const sala = await requisitar(`/api/salas/${encodeURIComponent(codigo)}/acoes`, { ...dados, acao, versao: estado.versao, partida: estado.id });
    if (sala.saiu || acao === 'sair') {
      sessionStorage.removeItem('conectaSaudeSala');
      window.location.href = '/home';
      return;
    }
    ultimaVersao = -1;
    renderizar(sala);
    selecionar('erro-sala').textContent = '';
  } catch (erro) {
    selecionar('erro-sala').textContent = erro.message || 'Não foi possível enviar a jogada.';
    ultimaVersao = -1;
  } finally {
    ocupado = false;
    selecionar('sair-sala').disabled = false;
  }
}

selecionar('iniciar-sala').addEventListener('click', () => agir('iniciar'));
function sairDaSala(evento) {
  evento.preventDefault();
  if (!estado || encerrado) { window.location.href = '/home'; return; }
  if (estado.status === 'jogando' && !window.confirm('Desistir da partida? O outro aluno vencerá e o histórico será salvo.')) return;
  agir('sair');
}
selecionar('sair-sala').addEventListener('click', sairDaSala);
selecionar('voltar-inicio-sala').addEventListener('click', sairDaSala);
document.querySelectorAll('#tabuleiro-sala button').forEach((botao, casa) => botao.addEventListener('click', () => agir('jogar', { casa })));
if (!/^[0-9]{1,8}$/.test(codigo)) {
  encerrado = true;
  selecionar('erro-sala').textContent = 'Código inválido. Volte ao início para criar ou entrar em uma sala.';
} else {
  sessionStorage.setItem('conectaSaudeSala', codigo);
  atualizar();
  window.setInterval(atualizar, 1000);
}
