document
  .querySelectorAll('input[autocomplete="new-password"]')
  .forEach((campo) => {
    if (!["senha-cadastro", "nova-senha"].includes(campo.id)) return;
    const regras = [
      ["Pelo menos 8 caracteres", (valor) => valor.length >= 8],
      ["Uma letra maiúscula", (valor) => /[A-Z]/.test(valor)],
      ["Um número", (valor) => /[0-9]/.test(valor)],
      ["Um caractere especial", (valor) => /[^A-Za-z0-9]/.test(valor)],
    ];
    const lista = document.createElement("ul");
    lista.className = "requisitos-senha";
    lista.id = `${campo.id}-regras`;
    lista.setAttribute("aria-live", "polite");
    campo.setAttribute("aria-describedby", lista.id);
    const itens = regras.map(() => {
      const item = document.createElement("li");
      lista.append(item);
      return item;
    });
    (campo.closest(".campo-senha") || campo).after(lista);
    const atualizar = () => {
      let valida = true;
      regras.forEach(([rotulo, conferir], i) => {
        const ok = conferir(campo.value);
        valida = valida && ok;
        itens[i].textContent =
          `${ok ? "✓" : "○"} ${rotulo}${ok ? " — atendido" : ""}`;
        itens[i].classList.toggle("atendido", ok);
      });
      campo.setCustomValidity(
        valida ? "" : "Confira os requisitos da senha abaixo do campo.",
      );
    };
    campo.addEventListener("input", atualizar);
    campo.form.addEventListener("reset", () => setTimeout(atualizar, 0));
    atualizar();
  });
