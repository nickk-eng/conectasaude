const CHAVE_SESSAO = "conectaSaudeToken";

function salvarToken(token) {
  if (sessionStorage.getItem(CHAVE_SESSAO) !== token) removerToken();
  sessionStorage.setItem(CHAVE_SESSAO, token);
}

function removerToken() {
  sessionStorage.removeItem(CHAVE_SESSAO);
  sessionStorage.removeItem("conectaSaudeSala");
}

function apiFetch(url, opcoes = {}) {
  const cabecalhos = new Headers(opcoes.headers || {});
  const token = sessionStorage.getItem(CHAVE_SESSAO);

  if (token) cabecalhos.set("Authorization", `Bearer ${token}`);

  return fetch(url, { ...opcoes, headers: cabecalhos }).then((resposta) => {
    if (document.body.dataset.perfis && token === sessionStorage.getItem(CHAVE_SESSAO) && resposta.status === 401) {
      removerToken();
      window.location.replace("/");
    }
    if (resposta.status === 403) {
      resposta
        .clone()
        .json()
        .then((dados) => {
          if (token === sessionStorage.getItem(CHAVE_SESSAO) && dados.codigo === "APROVACAO_PROFESSOR_PENDENTE")
            window.location.replace("/aguardando-aprovacao");
        })
        .catch(() => {});
    }
    return resposta;
  });
}

async function verificarSessaoPagina() {
  const { perfis } = document.body.dataset;
  if (!sessionStorage.getItem(CHAVE_SESSAO)) {
    window.location.replace("/");
    return null;
  }

  try {
    const resposta = await apiFetch("/api/auth/eu");
    if (resposta.status === 401) return null;
    if (!resposta.ok) throw new Error();
    const sessao = await resposta.json();
    const espera = perfis === "espera";
    if (sessao.usuario.aguardandoAprovacao !== espera ||
        (!espera && !perfis.split(" ").includes(sessao.usuario.perfil))) {
      window.location.replace(sessao.destino);
      return null;
    }
    document.body.dataset.sessaoValidada = "true";
    return sessao;
  } catch {
    const aviso = document.createElement("p");
    aviso.className = "aviso-sessao";
    aviso.setAttribute("role", "alert");
    aviso.textContent = "Não foi possível verificar sua sessão. Recarregue a página para tentar novamente.";
    document.body.prepend(aviso);
    return null;
  }
}
