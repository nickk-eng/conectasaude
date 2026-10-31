const formPrivacidade = document.querySelector("#form-privacidade");
const mensagemPrivacidade = document.querySelector("#mensagem-privacidade");

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
    if (resposta.ok) formPrivacidade.reset();
  } catch (_erro) {
    mensagemPrivacidade.textContent = "Não foi possível conectar ao servidor.";
    mensagemPrivacidade.className = "mensagem erro";
  }
  
});
