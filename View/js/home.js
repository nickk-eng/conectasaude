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
    mostrarAvaliacoesDaTurma();
    mostrarIndicadoresIsts();
  } else if (usuario.perfil === 'aluno') {
    mostrarEtapaAvaliacao();
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
  const campoAno = document.querySelector('#turma-perfil');
  campoAno.value = aluno ? (usuario.turma || '') : '';
  campoAno.disabled = !aluno || Boolean(campoAno.value);
  document.querySelector('#aviso-ano-perfil').hidden = !aluno;
}

let paginaHistorico = 1;
let carregandoHistorico = false;
async function carregarHistorico(pagina = 1) {
  if (carregandoHistorico || usuarioAtual?.perfil !== 'aluno') return;
  carregandoHistorico = true;
  const status = document.querySelector('#status-historico');
  const dados = document.querySelector('#dados-historico');
  const tentar = document.querySelector('#recarregar-historico');
  dados.hidden = true;
  tentar.hidden = true;
  status.textContent = 'Carregando histórico…';
  try {
    const resposta = await apiFetch(`/api/aluno/historico?pagina=${pagina}`);
    const historico = await resposta.json();
    if (!resposta.ok) throw new Error(historico.mensagem || 'Não foi possível carregar seu histórico.');
    paginaHistorico = pagina;
    const totalQuestoes = historico.acertos + historico.erros;
    document.querySelector('#historico-acertos').textContent = historico.acertos;
    document.querySelector('#historico-erros').textContent = historico.erros;
    document.querySelector('#historico-taxa').textContent = `${totalQuestoes ? Math.round(historico.acertos / totalQuestoes * 100) : 0}%`;
    document.querySelector('#historico-total').textContent = `${historico.totalPartidas} partida(s) · ${totalQuestoes} questão(ões)`;
    const corpo = document.querySelector('#partidas-historico');
    corpo.replaceChildren();
    historico.partidas.forEach((partida) => {
      const linha = document.createElement('tr');
      const modo = partida.modo === 'sala' ? 'Sala multiplayer' : partida.modo === 'colega' ? 'Colega' : 'Computador';
      [new Date(partida.data).toLocaleString('pt-BR'), `${partida.nivel} / ${modo}`, partida.acertos, partida.erros].forEach((valor) => {
        const coluna = document.createElement('td');
        coluna.textContent = valor;
        linha.appendChild(coluna);
      });
      corpo.appendChild(linha);
    });
    status.textContent = historico.partidas.length ? '' : 'Você ainda não tem partidas concluídas.';
    document.querySelector('#historico-anterior').disabled = pagina <= 1;
    document.querySelector('#historico-proxima').disabled = pagina * 20 >= historico.totalPartidas;
    document.querySelector('#historico-pagina').textContent = `Página ${pagina}`;
    dados.hidden = false;
  } catch (erro) {
    status.textContent = erro.message || 'Não foi possível conectar ao servidor.';
    tentar.hidden = false;
  } finally {
    carregandoHistorico = false;
  }
}

document.querySelector('#historico-anterior').addEventListener('click', () => carregarHistorico(paginaHistorico - 1));
document.querySelector('#historico-proxima').addEventListener('click', () => carregarHistorico(paginaHistorico + 1));
document.querySelector('#recarregar-historico').addEventListener('click', () => carregarHistorico(paginaHistorico));

document.querySelector('#abrir-perfil').addEventListener('click', () => {
  telaPerfil.showModal();
  const historico = document.querySelector('#historico-aluno');
  historico.hidden = usuarioAtual?.perfil !== 'aluno';
  carregarHistorico();
});
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

    const colunaResponsaveis = document.createElement('td');
    const formulario = document.createElement('form');
    formulario.className = 'form-responsaveis';
    const campo = document.createElement('input');
    campo.type = 'text';
    campo.maxLength = 240;
    campo.value = aluno.responsaveisNome || '';
    campo.placeholder = 'Nome(s) do(s) responsável(is)';
    campo.setAttribute('aria-label', `Responsáveis legais de ${aluno.nome || aluno.email}`);
    const botao = document.createElement('button');
    botao.type = 'submit';
    botao.textContent = 'Salvar';
    const estado = document.createElement('span');
    estado.className = 'estado-responsaveis';
    estado.setAttribute('role', 'status');
    formulario.append(campo, botao, estado);
    formulario.addEventListener('submit', async (evento) => {
      evento.preventDefault();
      botao.disabled = true;
      estado.textContent = '';
      try {
        const resposta = await apiFetch(`/api/professor/alunos/${aluno.id}/responsaveis`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nomes: campo.value })
        });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.mensagem || 'Não foi possível salvar.');
        estado.textContent = 'Salvo';
        estado.className = 'estado-responsaveis sucesso';
      } catch (erro) {
        estado.textContent = erro.message || 'Falha ao conectar.';
        estado.className = 'estado-responsaveis erro';
      } finally {
        botao.disabled = false;
      }
    });
    colunaResponsaveis.appendChild(formulario);
    linha.appendChild(colunaResponsaveis);

    corpo.appendChild(linha);
  });
  document.querySelector('#sem-alunos').hidden = alunos.length > 0;
}

async function buscarEtapaAvaliacao() {
  try {
    const resposta = await apiFetch('/api/avaliacao/status');
    return resposta.ok ? await resposta.json() : null;
  } catch {
    return null;
  }
}

function formatarNota(nota) {
  return nota ? `${nota.acertos}/${nota.total} (${nota.percentual}%)` : null;
}

async function mostrarEtapaAvaliacao() {
  const etapa = await buscarEtapaAvaliacao();
  if (!etapa) return;

  const faltam = Math.max(etapa.partidasNecessarias - etapa.partidas, 0);
  const textos = {
    pre: {
      passo: 'Etapa 1 de 3', titulo: 'Pré-teste',
      texto: 'Antes de jogar, responda algumas perguntas para descobrirmos o que você já sabe.',
      botao: 'Fazer o pré-teste', link: '/avaliacao?tipo=pre'
    },
    jogar: {
      passo: 'Etapa 2 de 3', titulo: 'Hora de jogar',
      texto: `Pré-teste concluído: ${formatarNota(etapa.pre)}. Jogue ${faltam} partida(s) para liberar o pós-teste.`
    },
    pos: {
      passo: 'Etapa 3 de 3', titulo: 'Pós-teste liberado',
      texto: `Pré-teste: ${formatarNota(etapa.pre)}. Faça o pós-teste para ver o quanto você aprendeu.`,
      botao: 'Fazer o pós-teste', link: '/avaliacao?tipo=pos'
    },
    concluida: {
      passo: 'Avaliação concluída', titulo: 'Seu resultado',
      texto: `Pré-teste: ${formatarNota(etapa.pre)} | Pós-teste: ${formatarNota(etapa.pos)}.`,
      botao: 'Ver detalhes', link: '/avaliacao?tipo=pos'
    }
  }[etapa.proximaEtapa];

  document.querySelector('#avaliacao-passo').textContent = textos.passo;
  document.querySelector('#avaliacao-titulo').textContent = textos.titulo;
  document.querySelector('#avaliacao-texto').textContent = textos.texto;
  const botao = document.querySelector('#avaliacao-botao');
  botao.hidden = !textos.link;
  if (textos.link) {
    botao.textContent = textos.botao;
    botao.href = textos.link;
  }
  document.querySelector('#avaliacao-diagnostica').hidden = false;
}

async function mostrarAvaliacoesDaTurma() {
  const resposta = await apiFetch('/api/professor/avaliacoes');
  if (!resposta.ok) {
    document.querySelector('#grafico-avaliacoes').innerHTML = '<p class="grafico-vazio">Não foi possível carregar as avaliações.</p>';
    return;
  }
  const { alunos, mediaPre, mediaPos, ganhoMedio } = await resposta.json();
  const porcentagem = (valor) => (valor === null ? '—' : `${valor}%`);
  const pontos = (valor) => (valor === null ? '—' : `${valor > 0 ? '+' : ''}${valor} p.p.`);

  document.querySelector('#media-pre').textContent = porcentagem(mediaPre);
  document.querySelector('#media-pos').textContent = porcentagem(mediaPos);
  renderizarGraficoAvaliacoes(mediaPre, mediaPos);

  const corpo = document.querySelector('#corpo-avaliacoes');
  corpo.innerHTML = '';
  alunos.filter((aluno) => aluno.pre).forEach((aluno) => {
    const linha = document.createElement('tr');
    [
      aluno.nome || aluno.email,
      aluno.turma || 'Ainda não informado',
      formatarNota(aluno.pre),
      formatarNota(aluno.pos) || 'Pendente',
      pontos(aluno.evolucao)
    ].forEach((texto) => {
      const coluna = document.createElement('td');
      coluna.textContent = texto;
      linha.appendChild(coluna);
    });
    corpo.appendChild(linha);
  });

  document.querySelector('#sem-avaliacoes').hidden = alunos.some((aluno) => aluno.pre);
  document.querySelector('#resumo-evolucao').textContent =
    ganhoMedio === null ? '' : `Evolução média da turma (pós menos pré): ${pontos(ganhoMedio)}`;
}

function renderizarGraficoAvaliacoes(mediaPre, mediaPos) {
  const grafico = document.querySelector('#grafico-avaliacoes');
  const series = [
    { rotulo: 'Pré-teste', valor: mediaPre, cor: 'azul' },
    { rotulo: 'Pós-teste', valor: mediaPos, cor: 'verde' }
  ];
  grafico.replaceChildren();
  series.forEach(({ rotulo, valor, cor }) => {
    const linha = document.createElement('div');
    linha.className = 'barra-grafico';
    const cabecalho = document.createElement('div');
    cabecalho.className = 'barra-grafico-cabecalho';
    const nome = document.createElement('span');
    nome.textContent = rotulo;
    const numero = document.createElement('strong');
    numero.textContent = valor === null || valor === undefined ? 'Sem dados' : `${valor}%`;
    cabecalho.append(nome, numero);
    const trilho = document.createElement('div');
    trilho.className = 'barra-grafico-trilho';
    trilho.setAttribute('aria-hidden', 'true');
    const preenchimento = document.createElement('div');
    preenchimento.className = `barra-grafico-preenchimento ${cor}`;
    const largura = Number.isFinite(Number(valor)) ? Math.min(100, Math.max(0, Number(valor))) : 0;
    preenchimento.style.width = `${largura}%`;
    trilho.append(preenchimento);
    linha.append(cabecalho, trilho);
    grafico.append(linha);
  });
}

async function mostrarIndicadoresIsts() {
  const resposta = await apiFetch('/api/professor/indicadores-ists');
  if (!resposta.ok) {
    document.querySelector('#grafico-ists').innerHTML = '<p class="grafico-vazio">Não foi possível carregar os indicadores.</p>';
    return;
  }
  const { indicadores } = await resposta.json();
  renderizarGraficoIsts(indicadores);
  const corpo = document.querySelector('#corpo-indicadores-ists');
  corpo.innerHTML = '';
  indicadores.forEach((item) => {
    const linha = document.createElement('tr');
    [item.rotulo, item.total, item.aprovadas, item.pendentes, item.recusadas].forEach((valor) => {
      const coluna = document.createElement('td');
      coluna.textContent = valor;
      linha.appendChild(coluna);
    });
    corpo.appendChild(linha);
  });
}

function renderizarGraficoIsts(indicadores) {
  const grafico = document.querySelector('#grafico-ists');
  grafico.replaceChildren();
  const maiorTotal = Math.max(1, ...indicadores.map((item) => Number(item.total) || 0));
  indicadores.forEach((item) => {
    const linha = document.createElement('div');
    linha.className = 'barra-grafico barra-grafico-tema';
    const cabecalho = document.createElement('div');
    cabecalho.className = 'barra-grafico-cabecalho';
    const nome = document.createElement('span');
    nome.textContent = item.rotulo;
    const numero = document.createElement('strong');
    numero.textContent = String(Number(item.total) || 0);
    cabecalho.append(nome, numero);
    const trilho = document.createElement('div');
    trilho.className = 'barra-grafico-trilho';
    trilho.setAttribute('aria-hidden', 'true');
    const preenchimento = document.createElement('div');
    preenchimento.className = 'barra-grafico-preenchimento';
    preenchimento.style.width = `${Math.min(100, Math.max(0, ((Number(item.total) || 0) / maiorTotal) * 100))}%`;
    trilho.append(preenchimento);
    linha.append(cabecalho, trilho);
    grafico.append(linha);
  });
  if (indicadores.length === 0) {
    const vazio = document.createElement('p');
    vazio.className = 'grafico-vazio';
    vazio.textContent = 'Ainda não há perguntas cadastradas por tema.';
    grafico.append(vazio);
  }
}

async function carregarRelatorios() {
  const formulario = document.querySelector('#filtros-relatorio');
  const parametros = new URLSearchParams(new FormData(formulario));
  const mensagem = document.querySelector('#mensagem-relatorio');
  mensagem.textContent = 'Carregando relatórios…';
  try {
    const resposta = await apiFetch(`/api/professor/relatorios?${parametros}`);
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.mensagem || 'Não foi possível carregar os relatórios.');
    const corpo = document.querySelector('#corpo-relatorio');
    corpo.replaceChildren();
    let acertos = 0;
    let erros = 0;
    let partidas = 0;
    dados.alunos.forEach((aluno) => {
      acertos += Number(aluno.acertos);
      erros += Number(aluno.erros);
      partidas += Number(aluno.partidas);
      const linha = document.createElement('tr');
      [aluno.nome || 'Nome não informado', aluno.turma || '—', aluno.partidas, aluno.acertos, aluno.erros,
        `${aluno.taxaAcerto}%`, aluno.ultima_partida ? new Date(aluno.ultima_partida).toLocaleString('pt-BR') : 'Sem partidas']
        .forEach((valor) => {
          const celula = document.createElement('td');
          celula.textContent = valor;
          linha.appendChild(celula);
        });
      corpo.appendChild(linha);
    });
    const totalQuestoes = acertos + erros;
    mensagem.textContent = `${dados.alunos.length} aluno(s) · ${partidas} partidas · ${totalQuestoes ? Math.round(acertos / totalQuestoes * 100) : 0}% de acertos.`;
  } catch (erro) {
    mensagem.textContent = erro.message || 'Não foi possível conectar ao servidor.';
  }
}

document.querySelector('#abrir-relatorios')?.addEventListener('click', () => {
  const secao = document.querySelector('#relatorios-professor');
  secao.hidden = false;
  carregarRelatorios();
  secao.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.querySelector('#filtros-relatorio')?.addEventListener('submit', (evento) => {
  evento.preventDefault();
  carregarRelatorios();
});
document.querySelectorAll('.dificuldade').forEach((botao) => botao.addEventListener('click', () => {
  nivelEscolhido = botao.dataset.nivel;
  document.querySelector('#mensagem-jogo').textContent = `Você escolheu o nível ${nivelEscolhido}. Agora escolha como jogar.`;
}));


function sincronizarTemaSala() {
  const campo = document.querySelector('#categoria-ists-jogo');
  document.querySelector('#categoria-criar-sala').value = campo.value;
  document.querySelector('#tema-criar-sala').textContent = campo.value
    ? `Tema escolhido: ${campo.selectedOptions[0].textContent}`
    : 'Tema escolhido: todos os temas';
}

document.querySelector('#categoria-ists-jogo').addEventListener('change', sincronizarTemaSala);
sincronizarTemaSala();

document.querySelectorAll('.jogar').forEach((botao) => botao.addEventListener('click', async () => {
  if (botao.dataset.modo !== 'colega' && !nivelEscolhido) return document.querySelector('#mensagem-jogo').textContent = 'Escolha primeiro uma dificuldade.';
  const etapa = await buscarEtapaAvaliacao();
  if (etapa && !etapa.preConcluido) return window.location.href = '/avaliacao?tipo=pre';
  const categoriaIst = document.querySelector('#categoria-ists-jogo').value;
  if (botao.dataset.modo === 'colega') {
    const area = document.querySelector('#area-salas');
    document.querySelector('.jogar[data-modo="colega"]').setAttribute('aria-expanded', 'true');
    document.querySelector('#nivel-criar-sala').value = nivelEscolhido;
    sincronizarTemaSala();
    area.hidden = false;
    area.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  document.querySelector('#area-salas').hidden = true;
  document.querySelector('.jogar[data-modo="colega"]').setAttribute('aria-expanded', 'false');
  window.location.href = `/jogo?nivel=${encodeURIComponent(nivelEscolhido)}&modo=${botao.dataset.modo}&categoriaIst=${encodeURIComponent(categoriaIst)}`;
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
    body: JSON.stringify({ texto: formulario.get('texto'), alternativas: [formulario.get('alternativa1'), formulario.get('alternativa2'), formulario.get('alternativa3')], respostaCorreta: formulario.get('respostaCorreta'), nivel: formulario.get('nivel'), categoriaIst: formulario.get('categoriaIst') })
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

const codigoSalaAtual = sessionStorage.getItem('conectaSaudeSala');
if (codigoSalaAtual && document.querySelector('#voltar-sala')) {
  const voltar = document.querySelector('#voltar-sala');
  voltar.href = `/sala?codigo=${encodeURIComponent(codigoSalaAtual)}`;
  voltar.hidden = false;
}

async function abrirSala(evento, entrar) {
  evento.preventDefault();
  const formulario = evento.currentTarget;
  const botao = formulario.querySelector('button[type="submit"]');
  const mensagem = document.querySelector('#mensagem-salas');
  botao.disabled = true;
  mensagem.textContent = entrar ? 'Entrando na sala…' : 'Criando sala…';
  try {
    if (!entrar) sincronizarTemaSala();
    const dados = Object.fromEntries(new FormData(formulario));
    dados.codigo = dados.codigo.trim();
    const resposta = await apiFetch(entrar ? '/api/salas/entrar' : '/api/salas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados)
    });
    const sala = await resposta.json();
    if (!resposta.ok) throw new Error(sala.mensagem || 'Não foi possível abrir a sala.');
    sessionStorage.setItem('conectaSaudeSala', sala.codigo);
    window.location.href = `/sala?codigo=${encodeURIComponent(sala.codigo)}`;
  } catch (erro) {
    mensagem.textContent = erro.message || 'Não foi possível conectar ao servidor.';
    botao.disabled = false;
  }
}

document.querySelector('#criar-sala')?.addEventListener('submit', (evento) => abrirSala(evento, false));
document.querySelector('#entrar-sala')?.addEventListener('submit', (evento) => abrirSala(evento, true));
document.querySelectorAll('#area-salas input[name="codigo"]').forEach((campo) => {
  campo.addEventListener('input', () => { campo.value = campo.value.replace(/[^0-9]/g, '').slice(0, 8); });
});
