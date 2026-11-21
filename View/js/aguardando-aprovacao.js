const statusEspera = document.querySelector("#status-espera");
const verificarAprovacao = document.querySelector("#verificar-aprovacao");
let verificando = false;
let saindo = false;

async function consultarAprovacao(sessaoInicial) {
  if (verificando || saindo) return;
  verificando = true;
  verificarAprovacao.disabled = true;
  try {
    let dados = sessaoInicial;
    if (!dados) {
      const resposta = await apiFetch("/api/auth/eu");
      if (saindo || resposta.status === 401) return;
      if (!resposta.ok) throw new Error();
      dados = await resposta.json();
    }
    if (!dados.usuario.aguardandoAprovacao) {
      window.location.replace(dados.destino);
      return;
    }
    document.querySelector("#conta-espera").textContent = dados.usuario.email;
    const mensagens = {
      pendente: "Sua solicitação está pendente de aprovação.",
      recusado:
        "Sua solicitação foi recusada. Entre em contato com o administrador.",
      revogado:
        "Seu acesso foi revogado. Entre em contato com o administrador.",
    };
    statusEspera.textContent =
      mensagens[dados.usuario.statusProfessor] ||
      "Seu acesso depende da aprovação do administrador.";
  } catch {
    statusEspera.textContent =
      "Não foi possível verificar a aprovação. Tentaremos novamente em alguns segundos.";
  } finally {
    verificando = false;
    verificarAprovacao.disabled = false;
  }
}

verificarAprovacao.addEventListener("click", () => consultarAprovacao());
document.querySelector("#sair-espera").addEventListener("click", async () => {
  saindo = true;
  try {
    await apiFetch("/api/auth/sair", { method: "POST" });
  } finally {
    removerToken();
    window.location.replace("/");
  }
});
verificarSessaoPagina().then((sessao) => {
  if (!sessao) return;
  consultarAprovacao(sessao);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) consultarAprovacao();
  });
  setInterval(() => {
    if (!document.hidden) consultarAprovacao();
  }, 10000);
});
