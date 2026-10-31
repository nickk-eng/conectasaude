const lista = document.querySelector('#lista-perguntas');
const mensagem = document.querySelector('#mensagem-admin');
const corpoAuditoria = document.querySelector('#corpo-auditoria');
let adminAtualId = null;
const categoriasIst = { 'hiv-aids': 'HIV e aids', sifilis: 'Sífilis', gonorreia: 'Gonorreia', clamidia: 'Clamídia', hpv: 'HPV', 'herpes-genital': 'Herpes genital', 'hepatites-virais': 'Hepatites virais', tricomoniase: 'Tricomoníase', 'prevencao-geral': 'Prevenção e conceitos gerais' };
const rotulosStatus = { aprovada: 'Aprovadas', pendente: 'Pendentes', recusada: 'Recusadas' };

function mostrarMensagem(texto, tipo) { mensagem.textContent = texto; mensagem.className = `mensagem ${tipo}`; }
function escapar(texto) { const elemento = document.createElement('span'); elemento.textContent = texto; return elemento.innerHTML; }
function formatarData(data) { return new Date(data).toLocaleString('pt-BR'); }

async function carregarPerguntas() {

  
  const resposta = await apiFetch('/api/admin/perguntas');
  if (!resposta.ok) return window.location.href = '/';
  const { perguntas } = await resposta.json();
  atualizarResumoPerguntas(perguntas);
  document.querySelector('#sem-perguntas').hidden = perguntas.length > 0;
  lista.innerHTML = perguntas.map((pergunta) => {

    const alternativas = typeof pergunta.alternativas === 'string' ? JSON.parse(pergunta.alternativas) : pergunta.alternativas;
    const autor = pergunta.nome || pergunta.email;
    return `<article class="pergunta-admin"><div class="metadados"><span class="status ${escapar(pergunta.status)}">${escapar(pergunta.status)}</span><span>Categoria: ${escapar(categoriasIst[pergunta.categoria_ist] || 'Prevenção e conceitos gerais')}</span><span>Nível: ${escapar(pergunta.nivel)}</span><span>Enviada por: ${escapar(autor)}</span></div><h3>${escapar(pergunta.texto)}</h3><ol class="alternativas">${alternativas.map((alternativa, indice) => `<li class="${indice === pergunta.resposta_correta ? 'correta' : ''}">${escapar(alternativa)}${indice === pergunta.resposta_correta ? ' (correta)' : ''}</li>`).join('')}</ol><div class="acoes-admin">${pergunta.status === 'pendente' ? `<button data-id="${pergunta.id}" data-status="aprovada" type="button">Aprovar</button><button class="recusar" data-id="${pergunta.id}" data-status="recusada" type="button">Recusar</button>` : ''}<button data-editar="${pergunta.id}" type="button">Editar</button><button class="recusar" data-excluir="${pergunta.id}" type="button">Excluir</button></div></article>`;
  }).join('');
}

function atualizarResumoPerguntas(perguntas) {
  document.querySelector('#total-perguntas-admin').textContent = perguntas.length;
  const porStatus = Object.fromEntries(Object.keys(rotulosStatus).map((status) => [status, 0]));
  const porCategoria = Object.fromEntries(Object.keys(categoriasIst).map((categoria) => [categoria, 0]));
  perguntas.forEach((pergunta) => {
    if (Object.hasOwn(porStatus, pergunta.status)) porStatus[pergunta.status] += 1;
    if (Object.hasOwn(porCategoria, pergunta.categoria_ist)) porCategoria[pergunta.categoria_ist] += 1;
  });
  document.querySelector('#pendentes-admin').textContent = porStatus.pendente;
  renderizarBarrasAdmin('#grafico-status-perguntas', Object.entries(porStatus).map(([chave, total]) => ({ rotulo: rotulosStatus[chave], total, classe: chave })));
  renderizarBarrasAdmin('#grafico-temas-perguntas', Object.entries(porCategoria).map(([chave, total]) => ({ rotulo: categoriasIst[chave], total, classe: 'tema' })));
}

function renderizarBarrasAdmin(seletor, itens) {
  const grafico = document.querySelector(seletor);
  grafico.replaceChildren();
  const maiorTotal = Math.max(1, ...itens.map((item) => item.total));
  itens.forEach(({ rotulo, total, classe }) => {
    const linha = document.createElement('div');
    linha.className = 'barra-admin';
    const cabecalho = document.createElement('div');
    cabecalho.className = 'barra-admin-cabecalho';
    const nome = document.createElement('span');
    nome.textContent = rotulo;
    const valor = document.createElement('strong');
    valor.textContent = String(total);
    cabecalho.append(nome, valor);
    const trilho = document.createElement('div');
    trilho.className = 'barra-admin-trilho';
    trilho.setAttribute('aria-hidden', 'true');
    const preenchimento = document.createElement('div');
    preenchimento.className = `barra-admin-preenchimento ${classe}`;
    preenchimento.style.width = `${(total / maiorTotal) * 100}%`;
    trilho.append(preenchimento);
    linha.append(cabecalho, trilho);
    grafico.append(linha);
  });
}

async function carregarSolicitacoesPrivacidade() {
  const resposta = await apiFetch('/api/admin/solicitacoes-privacidade');
  if (!resposta.ok) return;
  const { solicitacoes } = await resposta.json();
  const corpo = document.querySelector('#corpo-solicitacoes');
  document.querySelector('#sem-solicitacoes').hidden = solicitacoes.length > 0;
  corpo.innerHTML = solicitacoes.map((item) => `<tr><td>${escapar(formatarData(item.criado_em))}</td><td>${escapar(item.solicitante)}</td><td>${escapar(item.tipo)}</td><td>${escapar(item.mensagem || '—')}</td><td>${escapar(item.status)}</td></tr>`).join('');
}
async function carregarAuditoria() {
  const resposta = await apiFetch('/api/admin/auditoria?limite=50');
  if (!resposta.ok) return;

  const { logs } = await resposta.json();
  document.querySelector('#sem-auditoria').hidden = logs.length > 0;
  corpoAuditoria.innerHTML = logs.map((log) => {
    const usuario = log.usuario_email || 'Visitante';
    return `<tr><td>${escapar(formatarData(log.criado_em))}</td><td>${escapar(usuario)}</td><td>${escapar(log.acao)}</td><td>${escapar(log.recurso)}</td><td>${escapar(log.metodo)} ${escapar(log.rota)}</td></tr>`;
  }).join('');
}

lista.addEventListener('click', async (evento) => {
  const editar = evento.target.closest('button[data-editar]');
  if (editar) {
    const resposta = await apiFetch('/api/admin/perguntas');
    const { perguntas } = await resposta.json();
    const pergunta = perguntas.find((item) => String(item.id) === editar.dataset.editar);
    if (!pergunta) return;
    const formulario = document.querySelector('#form-pergunta-admin');
    formulario.dataset.id = pergunta.id;
    formulario.elements.texto.value = pergunta.texto;
    formulario.elements.alternativas.value = (typeof pergunta.alternativas === 'string' ? JSON.parse(pergunta.alternativas) : pergunta.alternativas).join('\n');
    formulario.elements.respostaCorreta.value = pergunta.resposta_correta;
    formulario.elements.nivel.value = pergunta.nivel;
    formulario.elements.categoriaIst.value = pergunta.categoria_ist || 'prevencao-geral';
    formulario.elements.status.value = pergunta.status;
    document.querySelector('#titulo-form-pergunta-admin').textContent = 'Editar pergunta';
    formulario.hidden = false;
    formulario.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const excluir = evento.target.closest('button[data-excluir]');
  if (excluir) {
    if (!window.confirm('Excluir esta pergunta permanentemente?')) return;
    const resposta = await apiFetch(`/api/admin/perguntas/${excluir.dataset.excluir}`, { method: 'DELETE' });
    const dados = await resposta.json();
    mostrarMensagem(dados.mensagem, resposta.ok ? 'sucesso' : 'erro');
    if (resposta.ok) { carregarPerguntas(); carregarAuditoria(); }
    return;
  }
  const botao = evento.target.closest('button[data-id]');
  if (!botao) return;
  botao.disabled = true;

  const resposta = await apiFetch(`/api/admin/perguntas/${botao.dataset.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: botao.dataset.status }) });
  const dados = await resposta.json();
  mostrarMensagem(dados.mensagem, resposta.ok ? 'sucesso' : 'erro');
  if (resposta.ok) {
    carregarPerguntas();
    carregarAuditoria();
carregarSolicitacoesPrivacidade();
  } else botao.disabled = false;
});

const formularioPerguntaAdmin = document.querySelector('#form-pergunta-admin');
document.querySelector('#nova-pergunta-admin').addEventListener('click', () => {
  formularioPerguntaAdmin.reset();
  delete formularioPerguntaAdmin.dataset.id;
  formularioPerguntaAdmin.elements.status.value = 'aprovada';
  document.querySelector('#titulo-form-pergunta-admin').textContent = 'Nova pergunta';
  formularioPerguntaAdmin.hidden = false;
  formularioPerguntaAdmin.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.querySelector('#cancelar-pergunta-admin').addEventListener('click', () => { formularioPerguntaAdmin.hidden = true; formularioPerguntaAdmin.reset(); delete formularioPerguntaAdmin.dataset.id; });
formularioPerguntaAdmin.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const dados = new FormData(formularioPerguntaAdmin);
  const alternativas = String(dados.get('alternativas')).split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  const corpo = { texto: dados.get('texto'), alternativas, respostaCorreta: dados.get('respostaCorreta'), nivel: dados.get('nivel'), categoriaIst: dados.get('categoriaIst'), status: dados.get('status') };
  const id = formularioPerguntaAdmin.dataset.id;
  const resposta = await apiFetch(id ? `/api/admin/perguntas/${id}` : '/api/admin/perguntas', {
    method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo)
  });
  const resultado = await resposta.json();
  const status = document.querySelector('#mensagem-pergunta-admin');
  status.textContent = resultado.mensagem;
  status.className = `mensagem ${resposta.ok ? 'sucesso' : 'erro'}`;
  if (resposta.ok) { formularioPerguntaAdmin.hidden = true; formularioPerguntaAdmin.reset(); delete formularioPerguntaAdmin.dataset.id; carregarPerguntas(); carregarAuditoria(); }
});

async function carregarUsuarios() {
  const resposta = await apiFetch('/api/admin/usuarios');
  if (!resposta.ok) return;
  const { usuarios } = await resposta.json();
  document.querySelector('#usuarios-ativos-admin').textContent = usuarios.filter((usuario) => usuario.ativo).length;
  const corpo = document.querySelector('#corpo-usuarios');
  corpo.replaceChildren();
  document.querySelector('#sem-usuarios').hidden = usuarios.length > 0;
  usuarios.forEach((usuario) => {
    const linha = document.createElement('tr');
    [usuario.nome || '—', usuario.email, usuario.perfil + (usuario.solicitou_professor ? ' (solicitou professor)' : ''), usuario.turma || '—', usuario.ativo ? 'Ativo' : 'Desativado'].forEach((valor) => {
      const celula = document.createElement('td'); celula.textContent = valor; linha.appendChild(celula);
    });
    const celula = document.createElement('td');
    const acoes = document.createElement('div');
    acoes.className = 'acoes-usuarios';
    const botao = document.createElement('button'); botao.type = 'button';
    botao.textContent = usuario.ativo ? 'Desativar' : 'Reativar';
    botao.dataset.usuarioId = usuario.id; botao.dataset.ativo = String(!usuario.ativo);
    if (usuario.id === adminAtualId) { botao.disabled = true; botao.title = 'Você não pode desativar a própria conta.'; }
    if (usuario.ativo && usuario.perfil !== 'admin') {
      const decisoes = usuario.perfil === 'professor' ? [['revogar', 'Revogar acesso de professor']] :
        usuario.solicitou_professor ? [['aprovar', 'Aprovar professor'], ['recusar', 'Recusar solicitação']] : [];
      decisoes.forEach(([decisao, rotulo]) => {
        const acao = document.createElement('button');
        acao.type = 'button'; acao.textContent = rotulo;
        acao.dataset.usuarioId = usuario.id; acao.dataset.decisao = decisao;
        acoes.appendChild(acao);
      });
    }
    acoes.appendChild(botao); celula.appendChild(acoes); linha.appendChild(celula); corpo.appendChild(linha);
  });
}

document.querySelector('#corpo-usuarios').addEventListener('click', async (evento) => {
  const botao = evento.target.closest('button[data-usuario-id]');
  if (!botao) return;
  botao.disabled = true;
  let resposta;
  try {
    resposta = await apiFetch(`/api/admin/usuarios/${botao.dataset.usuarioId}${botao.dataset.decisao ? '/professor' : ''}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(botao.dataset.decisao ? { decisao: botao.dataset.decisao } : { ativo: botao.dataset.ativo === 'true' })
    });
  } catch {
    botao.disabled = false;
    document.querySelector('#mensagem-usuarios').textContent = 'Não foi possível conectar ao servidor.';
    return;
  }
  const resultado = await resposta.json();
  const status = document.querySelector('#mensagem-usuarios');
  status.textContent = resultado.mensagem || (resposta.ok ? 'Usuário atualizado.' : 'Não foi possível atualizar o usuário.');
  status.className = `mensagem ${resposta.ok ? 'sucesso' : 'erro'}`;
  if (resposta.ok) { carregarUsuarios(); carregarAuditoria(); } else botao.disabled = false;
});
document.querySelector('#atualizar-usuarios').addEventListener('click', carregarUsuarios);

document.querySelector('#atualizar-auditoria').addEventListener('click', carregarAuditoria);
document.querySelector('#atualizar-solicitacoes').addEventListener('click', carregarSolicitacoesPrivacidade);
document.querySelector('#sair').addEventListener('click', async () => { try { await apiFetch('/api/auth/sair', { method: 'POST' }); } finally { removerToken(); } window.location.href = '/'; });
async function iniciarAdmin() {
  const resposta = await apiFetch('/api/auth/eu');
  if (!resposta.ok) return window.location.href = '/';
  const { usuario } = await resposta.json();
  if (usuario.perfil !== 'admin') return window.location.href = '/home';
  adminAtualId = usuario.id;
  carregarPerguntas(); carregarUsuarios(); carregarAuditoria(); carregarSolicitacoesPrivacidade();
}
iniciarAdmin();
