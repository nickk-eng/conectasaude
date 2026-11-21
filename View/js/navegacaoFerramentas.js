function configurarNavegacaoFerramentas(id) {
  const raiz = document.getElementById(id);
  if (!raiz) return;
  let botaoAtivo = raiz.querySelector('[data-painel-target][aria-expanded="true"]');
  let painelAtivo = botaoAtivo
    ? document.getElementById(botaoAtivo.dataset.painelTarget)
    : null;

  function recolher(botao, painel) {
    if (!botao || !painel) return;
    botao.classList.remove("ativo");
    botao.setAttribute("aria-expanded", "false");
    painel.classList.remove("painel-aberto");
    window.setTimeout(() => {
      if (!painel.classList.contains("painel-aberto")) painel.hidden = true;
    }, 180);
  }

  raiz.addEventListener(
    "click",
    (evento) => {
      const botao = evento.target.closest("[data-painel-target]");
      if (!botao || !raiz.contains(botao)) return;
      const painel = document.getElementById(botao.dataset.painelTarget);
      if (!painel) return;
      if (botaoAtivo === botao) {
        recolher(botaoAtivo, painelAtivo);
        botaoAtivo = null;
        painelAtivo = null;
        return;
      }
      recolher(botaoAtivo, painelAtivo);
      botaoAtivo = botao;
      painelAtivo = painel;
      botao.classList.add("ativo");
      botao.setAttribute("aria-expanded", "true");
      painel.hidden = false;
      window.requestAnimationFrame(() => painel.classList.add("painel-aberto"));
      painel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    },
    true,
  );
}
