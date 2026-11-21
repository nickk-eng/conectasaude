const paginadoresTabelas = new WeakMap();

function paginarTabela(corpo, rotuloTabela) {
  let atualizar = paginadoresTabelas.get(corpo);
  if (!atualizar) {
    const nav = document.createElement("nav");
    nav.className = "paginacao";
    nav.setAttribute("aria-label", rotuloTabela);
    const anterior = document.createElement("button");
    anterior.type = "button";
    anterior.textContent = "Anterior";
    const proxima = document.createElement("button");
    proxima.type = "button";
    proxima.textContent = "Próxima";
    const rotulo = document.createElement("span");
    rotulo.setAttribute("aria-live", "polite");
    nav.append(anterior, rotulo, proxima);
    corpo.closest("table").parentElement.after(nav);

    const limite = 5;
    let pagina = 1;
    atualizar = () => {
      const linhas = Array.from(corpo.rows);
      const total = Math.max(1, Math.ceil(linhas.length / limite));
      pagina = Math.max(1, Math.min(pagina, total));
      const inicio = (pagina - 1) * limite;
      linhas.forEach((linha, indice) => {
        linha.hidden = indice < inicio || indice >= inicio + limite;
      });
      nav.hidden = total === 1;
      anterior.disabled = pagina === 1;
      proxima.disabled = pagina === total;
      rotulo.textContent = `Página ${pagina} de ${total}`;
    };
    anterior.addEventListener("click", () => {
      pagina -= 1;
      atualizar();
      if (anterior.disabled) proxima.focus();
    });
    proxima.addEventListener("click", () => {
      pagina += 1;
      atualizar();
      if (proxima.disabled) anterior.focus();
    });
    paginadoresTabelas.set(corpo, atualizar);
  }
  atualizar();
}
