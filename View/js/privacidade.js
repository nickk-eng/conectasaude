const formPrivacidade = document.querySelector("#form-privacidade");
const mensagemPrivacidade = document.querySelector("#mensagem-privacidade");

async function carregarEmailTitular() {
  const elemento = document.querySelector("#email-titular");
  try {
    const resposta = await apiFetch("/api/auth/eu");
    if (!resposta.ok) return;
    const { usuario } = await resposta.json();
    elemento.textContent = `Conta autenticada: ${usuario.email}`;
    elemento.hidden = false;
  } catch {}
}

carregarEmailTitular();

const rotulosPrivacidade = {
  recebida: "Recebida",
  em_analise: "Em análise",
  concluida: "Concluída",
  recusada: "Recusada",
};
async function carregarMinhasSolicitacoes() {
  try {
    const resposta = await apiFetch("/api/privacidade/solicitacoes");
    if (resposta.status === 401) {
      document.querySelector("#acesso-privacidade").hidden = false;
      formPrivacidade.hidden = true;
      document.querySelector("#historico-privacidade").hidden = true;
      return;
    }
    if (!resposta.ok) throw new Error("consulta");
    formPrivacidade.hidden = false;
    document.querySelector("#acesso-privacidade").hidden = true;
    document.querySelector("#historico-privacidade").hidden = false;
    const { solicitacoes } = await resposta.json();
    const lista = document.querySelector("#minhas-solicitacoes");
    lista.replaceChildren();
    if (!solicitacoes.length)
      lista.textContent = "Você ainda não registrou solicitações.";
    solicitacoes.forEach((item) => {
      const card = document.createElement("article");
      card.className = "solicitacao-privacidade";
      const titulo = document.createElement("h3");
      titulo.textContent = `Pedido #${item.id} — ${rotulosPrivacidade[item.status] || item.status}`;
      const detalhes = document.createElement("p");
      detalhes.textContent = `${new Date(item.criado_em).toLocaleString("pt-BR")} · ${item.tipo}: ${item.mensagem || "Sem detalhes adicionais."}`;
      const resposta = document.createElement("p");
      resposta.textContent = item.resposta
        ? `Resposta da equipe: ${item.resposta}`
        : "Aguardando resposta da equipe.";
      card.append(titulo, detalhes, resposta);
      if (item.providencia) {
        const providencia = document.createElement("p");
        providencia.textContent = `Providência: ${item.providencia}`;
        card.append(providencia);
      }
      if (item.comprovante) {
        const comprovante = document.createElement("p");
        comprovante.textContent = `Comprovação: ${item.comprovante}`;
        card.append(comprovante);
      }
      lista.append(card);
    });
  } catch {
    mensagemPrivacidade.textContent =
      "Não foi possível carregar seus pedidos. Tente atualizar a página.";
    mensagemPrivacidade.className = "mensagem erro";
  }
}

document
  .querySelector("#atualizar-minhas-solicitacoes")
  .addEventListener("click", carregarMinhasSolicitacoes);
carregarMinhasSolicitacoes();

formPrivacidade.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const dados = new FormData(formPrivacidade);
  try {
    const resposta = await apiFetch("/api/privacidade/solicitacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: dados.get("tipo"),
        mensagem: dados.get("mensagem"),
      }),
    });
    const resultado = await resposta.json();
    mensagemPrivacidade.textContent =
      resultado.mensagem || "Não foi possível registrar a solicitação.";
    mensagemPrivacidade.className = `mensagem ${resposta.ok ? "sucesso" : "erro"}`;
    if (resposta.ok) {
      formPrivacidade.reset();
      await carregarMinhasSolicitacoes();
    }
  } catch (_erro) {
    mensagemPrivacidade.textContent = "Não foi possível conectar ao servidor.";
    mensagemPrivacidade.className = "mensagem erro";
  }
});
