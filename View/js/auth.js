const CHAVE_SESSAO = 'conectaSaudeToken';

function salvarToken(token) {
  sessionStorage.setItem(CHAVE_SESSAO, token);
}

function removerToken() {
  sessionStorage.removeItem(CHAVE_SESSAO);
}

function apiFetch(url, opcoes = {}) {
  const cabecalhos = new Headers(opcoes.headers || {});
  const token = sessionStorage.getItem(CHAVE_SESSAO);

  if (token) cabecalhos.set('Authorization', `Bearer ${token}`);

  return fetch(url, { ...opcoes, headers: cabecalhos });
}
