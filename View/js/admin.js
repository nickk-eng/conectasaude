const lista = document.querySelector('#lista-perguntas');
const mensagem = document.querySelector('#mensagem-admin');
const corpoAuditoria = document.querySelector('#corpo-auditoria');

function mostrarMensagem(texto, tipo) { mensagem.textContent = texto; mensagem.className = `mensagem ${tipo}`; }
function escapar(texto) { const elemento = document.createElement('span'); elemento.textContent = texto; return elemento.innerHTML; }
function formatarData(data) { return new Date(data).toLocaleString('pt-BR'); }

async function carregarPerguntas() {

  const resposta = await apiFetch('/api/admin/perguntas');
  if (!resposta.ok) return window.location.href = '/';
  const { perguntas } = await resposta.json();
  document.querySelector('#sem-perguntas').hidden = perguntas.length > 0;
  lista.innerHTML = perguntas.map((pergunta) => {

    const alternativas = typeof pergunta.alternativas === 'string' ? JSON.parse(pergunta.alternativas) : pergunta.alternativas;
    const autor = pergunta.nome || pergunta.email;
    return `<article class="pergunta-admin"><div class="metadados"><span class="status ${pergunta.status}">${pergunta.status}</span><span>Nível: ${escapar(pergunta.nivel)}</span><span>Enviada por: ${escapar(autor)}</span></div><h3>${escapar(pergunta.texto)}</h3><ol class="alternativas">${alternativas.map((alternativa, indice) => `<li class="${indice === pergunta.resposta_correta ? 'correta' : ''}">${escapar(alternativa)}${indice === pergunta.resposta_correta ? ' (correta)' : ''}</li>`).join('')}</ol>${pergunta.status === 'pendente' ? `<div class="acoes-admin"><button data-id="${pergunta.id}" data-status="aprovada" type="button">Aprovar</button><button class="recusar" data-id="${pergunta.id}" data-status="recusada" type="button">Recusar</button></div>` : ''}</article>`;
  }).join('');
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

document.querySelector('#atualizar-auditoria').addEventListener('click', carregarAuditoria);
document.querySelector('#atualizar-solicitacoes').addEventListener('click', carregarSolicitacoesPrivacidade);
document.querySelector('#sair').addEventListener('click', async () => { try { await apiFetch('/api/auth/sair', { method: 'POST' }); } finally { removerToken(); } window.location.href = '/'; });
carregarPerguntas();
carregarAuditoria();
carregarSolicitacoesPrivacidade();
