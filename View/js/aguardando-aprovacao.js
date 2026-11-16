const statusEspera = document.querySelector("#status-espera");
const verificarAprovacao = document.querySelector("#verificar-aprovacao");
let verificando = false;
let saindo = false;

async function consultarAprovacao() {
  if (verificando || saindo) return;
  verificando = true;
  verificarAprovacao.disabled = true;
  try {
    const resposta = await apiFetch("/api/auth/eu");
    if (saindo) return;
    if (resposta.status === 401) {
      removerToken();
      window.location.replace("/");
      return;
    }
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error();
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

verificarAprovacao.addEventListener("click", consultarAprovacao);
document.querySelector("#sair-espera").addEventListener("click", async () => {
  saindo = true;
  try {
    await apiFetch("/api/auth/sair", { method: "POST" });
  } finally {
    removerToken();
    window.location.replace("/");
  }
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) consultarAprovacao();
});
setInterval(() => {
  if (!document.hidden) consultarAprovacao();
}, 10000);
consultarAprovacao();
