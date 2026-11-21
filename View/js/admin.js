const lista = document.querySelector("#lista-perguntas");
const mensagem = document.querySelector("#mensagem-admin");
const corpoAuditoria = document.querySelector("#corpo-auditoria");
configurarNavegacaoFerramentas("navegacao-admin");
let adminAtualId = null;
let paginaPerguntas = 0;
let perguntasAtuais = [];
let consultaPerguntas = 0;
let ultimaConsultaAplicada = 0;
let versaoPerguntas;
let cursoresAuditoria = [null];
let paginaAuditoria = 0;
const categoriasIst = {
  "hiv-aids": "HIV e aids",
  sifilis: "Sífilis",
  gonorreia: "Gonorreia",
  clamidia: "Clamídia",
  hpv: "HPV",
  "herpes-genital": "Herpes genital",
  "hepatites-virais": "Hepatites virais",
  tricomoniase: "Tricomoníase",
  "prevencao-geral": "Prevenção e conceitos gerais",
};
const rotulosStatus = {
  aprovada: "Aprovadas",
  pendente: "Pendentes",
  recusada: "Recusadas",
};
const statusPrivacidade = {
  recebida: "Recebida",
  em_analise: "Em análise",
  concluida: "Concluída",
  recusada: "Recusada",
};

function controlesPaginas(seletor, pagina, temAnterior, temProxima, navegar) {
  const nav = document.querySelector(seletor);
  nav.replaceChildren();
  const anterior = document.createElement("button");
  anterior.type = "button";
  anterior.textContent = "← Anterior";
  anterior.disabled = !temAnterior;
  anterior.addEventListener("click", () => navegar(-1));
  const rotulo = document.createElement("span");
  rotulo.setAttribute("aria-live", "polite");
  rotulo.textContent = `Página ${pagina + 1}`;
  const proxima = document.createElement("button");
  proxima.type = "button";
  proxima.textContent = "Próxima →";
  proxima.disabled = !temProxima;
  proxima.addEventListener("click", () => navegar(1));
  nav.append(anterior, rotulo, proxima);
}

document
  .querySelector("#corpo-solicitacoes")
  .addEventListener("submit", async (evento) => {
    const form = evento.target.closest("form[data-solicitacao]");
    if (!form) return;
    evento.preventDefault();
    const botao = form.querySelector("button");
    botao.disabled = true;
    try {
      const dados = new FormData(form);
      const eliminar =
        dados.get("status") === "concluida" &&
        form.dataset.tipo === "eliminacao";
      if (
        eliminar &&
        !window.confirm(
          "Concluir este pedido excluirá definitivamente a conta do solicitante, credenciais, vínculos, avaliações, partidas e pedidos do banco ativo. Escolas e turmas próprias também serão excluídas. Confirma?",
        )
      )
        return;
      const resposta = await apiFetch(
        `/api/admin/solicitacoes-privacidade/${form.dataset.solicitacao}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: dados.get("status"),
            resposta: dados.get("resposta"),
            providencia: dados.get("providencia"),
            comprovante: dados.get("comprovante"),
            confirmouAtendimento: dados.get("confirmouAtendimento") === "on",
            confirmarEliminacao: eliminar,
          }),
        },
      );
      const resultado = await resposta.json();
      mostrarMensagem(resultado.mensagem, resposta.ok ? "sucesso" : "erro");
      if (resposta.ok) {
        carregarSolicitacoesPrivacidade();
        carregarAuditoria();
      }
    } catch {
      mostrarMensagem("Não foi possível salvar a resposta.", "erro");
    } finally {
      botao.disabled = false;
    }
  });

function mostrarMensagem(texto, tipo) {
  mensagem.textContent = texto;
  mensagem.className = `mensagem ${tipo}`;
}
function escapar(texto) {
  const elemento = document.createElement("span");
  elemento.textContent = texto;
  return elemento.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function formatarData(data) {
  return new Date(data).toLocaleString("pt-BR");
}

async function carregarPerguntas() {
  const consulta = ++consultaPerguntas;
  let perguntas;
  try {
    const resposta = await apiFetch("/api/admin/perguntas");
    if (!resposta.ok) return;
    ({ perguntas } = await resposta.json());
  } catch {
    return;
  }
  if (consulta < ultimaConsultaAplicada) return;
  ultimaConsultaAplicada = consulta;
  const versao = JSON.stringify(perguntas);
  if (versao === versaoPerguntas) return;
  versaoPerguntas = versao;
  atualizarResumoPerguntas(perguntas);
  document.querySelector("#sem-perguntas").hidden = perguntas.length > 0;
  perguntasAtuais = perguntas;
  paginaPerguntas = Math.min(
    paginaPerguntas,
    Math.max(0, Math.ceil(perguntas.length / 5) - 1),
  );
  renderizarPerguntas();
}

function renderizarPerguntas() {
  const perguntas = perguntasAtuais;
  controlesPaginas(
    "#paginas-perguntas",
    paginaPerguntas,
    paginaPerguntas > 0,
    (paginaPerguntas + 1) * 5 < perguntas.length,
    (passo) => {
      paginaPerguntas += passo;
      renderizarPerguntas();
    },
  );
  lista.innerHTML = perguntas
    .slice(paginaPerguntas * 5, paginaPerguntas * 5 + 5)
    .map((pergunta) => {
      const alternativas =
        typeof pergunta.alternativas === "string"
          ? JSON.parse(pergunta.alternativas)
          : pergunta.alternativas;
      const autor = pergunta.nome || pergunta.email;
      return `<article class="pergunta-admin"><div class="metadados"><span class="status ${escapar(pergunta.status)}">${escapar(pergunta.status)}</span><span>Categoria: ${escapar(categoriasIst[pergunta.categoria_ist] || "Prevenção e conceitos gerais")}</span><span>Nível: ${escapar(pergunta.nivel)}</span><span>Enviada por: ${escapar(autor)}</span></div><h3>${escapar(pergunta.texto)}</h3><ol class="alternativas">${alternativas.map((alternativa, indice) => `<li class="${indice === pergunta.resposta_correta ? "correta" : ""}">${escapar(alternativa)}${indice === pergunta.resposta_correta ? " (correta)" : ""}</li>`).join("")}</ol><div class="acoes-admin">${pergunta.status === "pendente" ? `<button data-id="${pergunta.id}" data-status="aprovada" type="button">Aprovar</button><button class="recusar" data-id="${pergunta.id}" data-status="recusada" type="button">Recusar</button>` : ""}<button data-editar="${pergunta.id}" type="button">Editar</button><button class="recusar" data-excluir="${pergunta.id}" type="button">Excluir</button></div></article>`;
    })
    .join("");
}

function atualizarResumoPerguntas(perguntas) {
  document.querySelector("#total-perguntas-admin").textContent =
    perguntas.length;
  const porStatus = Object.fromEntries(
    Object.keys(rotulosStatus).map((status) => [status, 0]),
  );
  const porCategoria = Object.fromEntries(
    Object.keys(categoriasIst).map((categoria) => [categoria, 0]),
  );
  perguntas.forEach((pergunta) => {
    if (Object.hasOwn(porStatus, pergunta.status))
      porStatus[pergunta.status] += 1;
    if (Object.hasOwn(porCategoria, pergunta.categoria_ist))
      porCategoria[pergunta.categoria_ist] += 1;
  });
  document.querySelector("#pendentes-admin").textContent = porStatus.pendente;
  document.querySelector("#perguntas-aprovadas-admin").textContent =
    porStatus.aprovada;
  renderizarBarrasAdmin(
    "#grafico-status-perguntas",
    Object.entries(porStatus).map(([chave, total]) => ({
      rotulo: rotulosStatus[chave],
      total,
      classe: chave,
    })),
  );
  renderizarBarrasAdmin(
    "#grafico-temas-perguntas",
    Object.entries(porCategoria).map(([chave, total]) => ({
      rotulo: categoriasIst[chave],
      total,
      classe: "tema",
    })),
  );
}

function renderizarBarrasAdmin(seletor, itens) {
  const grafico = document.querySelector(seletor);
  grafico.replaceChildren();
  const maiorTotal = Math.max(1, ...itens.map((item) => item.total));
  itens.forEach(({ rotulo, total, classe }) => {
    const linha = document.createElement("div");
    linha.className = "barra-admin";
    const cabecalho = document.createElement("div");
    cabecalho.className = "barra-admin-cabecalho";
    const nome = document.createElement("span");
    nome.textContent = rotulo;
    const valor = document.createElement("strong");
    valor.textContent = String(total);
    cabecalho.append(nome, valor);
    const trilho = document.createElement("div");
    trilho.className = "barra-admin-trilho";
    trilho.setAttribute("aria-hidden", "true");
    const preenchimento = document.createElement("div");
    preenchimento.className = `barra-admin-preenchimento ${classe}`;
    preenchimento.style.width = `${(total / maiorTotal) * 100}%`;
    trilho.append(preenchimento);
    linha.append(cabecalho, trilho);
    grafico.append(linha);
  });
}

async function carregarSolicitacoesPrivacidade() {
  const resposta = await apiFetch("/api/admin/solicitacoes-privacidade");
  if (!resposta.ok) return;
  const { solicitacoes } = await resposta.json();
  const corpo = document.querySelector("#corpo-solicitacoes");
  document.querySelector("#sem-solicitacoes").hidden = solicitacoes.length > 0;
  corpo.innerHTML = solicitacoes
    .map((item) => {
      const finalizado = ["concluida", "recusada"].includes(item.status);
      const registro = `<p>${escapar(item.resposta || "Sem resposta registrada.")}</p>
      <p>Providência: ${escapar(item.providencia || "Não registrada.")}</p>
      <p>Comprovação: ${escapar(item.comprovante || "Não registrada.")}</p>
      <p>${item.verificada_em ? "Atendimento confirmado em " + escapar(formatarData(item.verificada_em)) : "Sem confirmação de execução registrada."}</p>`;
      const formulario = `<form data-solicitacao="${item.id}" data-tipo="${escapar(item.tipo)}">
      <label>Status<select name="status" aria-label="Status da solicitação">${Object.entries(
        statusPrivacidade,
      )
        .map(
          ([valor, rotulo]) =>
            `<option value="${valor}" ${valor === item.status ? "selected" : ""}>${rotulo}</option>`,
        )
        .join("")}</select></label>
      <label>Resposta ao titular<textarea name="resposta" maxlength="2000" rows="3">${escapar(item.resposta || "")}</textarea></label>
      <label>Providência realizada<textarea name="providencia" maxlength="2000" rows="3" placeholder="Para concluir, descreva a ação realizada com pelo menos 20 caracteres.">${escapar(item.providencia || "")}</textarea></label>
      <label>Referência de comprovação<input name="comprovante" maxlength="500" placeholder="Protocolo ou referência verificável, sem senhas ou dados de terceiros." value="${escapar(item.comprovante || "")}"></label>
      <label><input type="checkbox" name="confirmouAtendimento">Confirmo que conferi o atendimento e sua comprovação.${item.tipo === "eliminacao" ? " Autorizo a execução da exclusão pelo sistema." : ""}</label>
      ${item.tipo === "eliminacao" ? "<p>Concluir este pedido exclui definitivamente a conta e os dados vinculados do banco ativo. O recibo permanece sem identificação do titular.</p>" : ""}
      <button type="submit">Salvar atendimento</button></form>`;
      return `<tr><td>${escapar(formatarData(item.criado_em))}</td><td>${escapar(item.solicitante)}</td><td>${escapar(item.tipo)}</td><td>${escapar(item.mensagem || "—")}</td><td>${finalizado ? registro : formulario}</td></tr>`;
    })
    .join("");
  paginarTabela(corpo, "Páginas das solicitações de privacidade");
}
async function carregarAuditoria() {
  const cursor = cursoresAuditoria[paginaAuditoria];
  const resposta = await apiFetch(
    "/api/admin/auditoria?limite=5" +
      (cursor ? "&antes=" + encodeURIComponent(cursor) : ""),
  );
  if (!resposta.ok) return;

  const { logs, temMais } = await resposta.json();
  if (temMais && logs.length)
    cursoresAuditoria[paginaAuditoria + 1] = logs[logs.length - 1].id;
  controlesPaginas(
    "#paginas-auditoria",
    paginaAuditoria,
    paginaAuditoria > 0,
    temMais,
    (passo) => {
      paginaAuditoria += passo;
      carregarAuditoria();
    },
  );
  document.querySelector("#sem-auditoria").hidden = logs.length > 0;
  corpoAuditoria.innerHTML = logs
    .map((log) => {
      const detalhes = log.detalhes || {};
      const usuario = detalhes.solicitanteNome
        ? `${detalhes.solicitanteNome} (${detalhes.solicitantePerfil || log.perfil || ""})`
        : log.usuario_email || "Visitante";
      const acoes = {
        REVELAR_EMAIL_USUARIO: "Revelou e-mail de usuário",
        REVELAR_EMAIL_ALUNO: "Revelou e-mail de aluno",
        REVELAR_EMAIL_ALUNO_NEGADO: "Tentativa negada de revelar e-mail de aluno",
      };
      const alvo = detalhes.alvoNome
        ? `${detalhes.alvoNome} · ${detalhes.alvoEmail || "E-mail mascarado"}`
        : "—";
      return `<tr><td>${escapar(formatarData(log.criado_em))}</td><td>${escapar(usuario)}</td><td>${escapar(alvo)}</td><td>${escapar(acoes[log.acao] || log.acao)}</td><td>${escapar(log.recurso)}</td><td>${escapar(log.metodo)} ${escapar(log.rota)}</td></tr>`;
    })
    .join("");
}

lista.addEventListener("click", async (evento) => {
  const editar = evento.target.closest("button[data-editar]");
  if (editar) {
    const resposta = await apiFetch("/api/admin/perguntas");
    const { perguntas } = await resposta.json();
    const pergunta = perguntas.find(
      (item) => String(item.id) === editar.dataset.editar,
    );
    if (!pergunta) return;
    const formulario = document.querySelector("#form-pergunta-admin");
    document
      .querySelector('[data-painel-target="painel-admin-perguntas"]')
      .click();
    formulario.dataset.id = pergunta.id;
    formulario.elements.texto.value = pergunta.texto;
    formulario.elements.alternativas.value = (
      typeof pergunta.alternativas === "string"
        ? JSON.parse(pergunta.alternativas)
        : pergunta.alternativas
    ).join("\n");
    formulario.elements.respostaCorreta.value = pergunta.resposta_correta;
    formulario.elements.nivel.value = pergunta.nivel;
    formulario.elements.categoriaIst.value =
      pergunta.categoria_ist || "prevencao-geral";
    formulario.elements.status.value = pergunta.status;
    document.querySelector("#titulo-form-pergunta-admin").textContent =
      "Editar pergunta";
    formulario.hidden = false;
    formulario.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const excluir = evento.target.closest("button[data-excluir]");
  if (excluir) {
    if (!window.confirm("Excluir esta pergunta permanentemente?")) return;
    const resposta = await apiFetch(
      `/api/admin/perguntas/${excluir.dataset.excluir}`,
      { method: "DELETE" },
    );
    const dados = await resposta.json();
    mostrarMensagem(dados.mensagem, resposta.ok ? "sucesso" : "erro");
    if (resposta.ok) {
      carregarPerguntas();
      carregarAuditoria();
    }
    return;
  }
  const botao = evento.target.closest("button[data-id]");
  if (!botao) return;
  botao.disabled = true;

  const resposta = await apiFetch(`/api/admin/perguntas/${botao.dataset.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: botao.dataset.status }),
  });
  const dados = await resposta.json();
  mostrarMensagem(dados.mensagem, resposta.ok ? "sucesso" : "erro");
  if (resposta.ok) {
    carregarPerguntas();
    carregarAuditoria();
    carregarSolicitacoesPrivacidade();
  } else botao.disabled = false;
});

const formularioPerguntaAdmin = document.querySelector("#form-pergunta-admin");
document.querySelector("#nova-pergunta-admin").addEventListener("click", () => {
  formularioPerguntaAdmin.reset();
  delete formularioPerguntaAdmin.dataset.id;
  formularioPerguntaAdmin.elements.status.value = "aprovada";
  document.querySelector("#titulo-form-pergunta-admin").textContent =
    "Nova pergunta";
  formularioPerguntaAdmin.hidden = false;
  formularioPerguntaAdmin.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
});
document
  .querySelector("#cancelar-pergunta-admin")
  .addEventListener("click", () => {
    formularioPerguntaAdmin.hidden = true;
    formularioPerguntaAdmin.reset();
    delete formularioPerguntaAdmin.dataset.id;
  });
formularioPerguntaAdmin.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const dados = new FormData(formularioPerguntaAdmin);
  const alternativas = String(dados.get("alternativas"))
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  const corpo = {
    texto: dados.get("texto"),
    alternativas,
    respostaCorreta: dados.get("respostaCorreta"),
    nivel: dados.get("nivel"),
    categoriaIst: dados.get("categoriaIst"),
    status: dados.get("status"),
  };
  const id = formularioPerguntaAdmin.dataset.id;
  const resposta = await apiFetch(
    id ? `/api/admin/perguntas/${id}` : "/api/admin/perguntas",
    {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    },
  );
  const resultado = await resposta.json();
  const status = document.querySelector("#mensagem-pergunta-admin");
  status.textContent = resultado.mensagem;
  status.className = `mensagem ${resposta.ok ? "sucesso" : "erro"}`;
  if (resposta.ok) {
    formularioPerguntaAdmin.hidden = true;
    formularioPerguntaAdmin.reset();
    delete formularioPerguntaAdmin.dataset.id;
    carregarPerguntas();
    carregarAuditoria();
  }
});

async function carregarUsuarios() {
  const resposta = await apiFetch("/api/admin/usuarios");
  if (!resposta.ok) return;
  const { usuarios } = await resposta.json();
  document.querySelector("#usuarios-ativos-admin").textContent =
    usuarios.filter((usuario) => usuario.ativo).length;
  document.querySelector("#cadastros-pendentes-admin").textContent =
    usuarios.filter((usuario) => usuario.ativo && usuario.status_professor === "pendente").length;
  const corpo = document.querySelector("#corpo-usuarios");
  corpo.replaceChildren();
  document.querySelector("#sem-usuarios").hidden = usuarios.length > 0;
  usuarios.forEach((usuario) => {
    const linha = document.createElement("tr");
    const situacoesProfessor = {
      nao_solicitado: "Professor (aguardando primeiro acesso com 2FA)",
      pendente: "Professor (aguardando aprovação)",
      recusado: "Professor (solicitação recusada)",
      revogado: "Professor (acesso revogado)",
    };
    const perfilExibido =
      usuario.perfil === "aluno" && situacoesProfessor[usuario.status_professor]
        ? situacoesProfessor[usuario.status_professor]
        : usuario.perfil;
    [usuario.nome || "—"].forEach((valor) => {
      const celula = document.createElement("td");
      celula.textContent = valor;
      linha.appendChild(celula);
    });
    const celulaEmail = document.createElement("td");
    const emailTexto = document.createElement("span");
    emailTexto.textContent = usuario.email || "—";
    const revelar = document.createElement("button");
    revelar.type = "button";
    revelar.className = "botao-revelar-email";
    revelar.textContent = "Revelar";
    revelar.setAttribute("aria-label", `Revelar e-mail de ${usuario.nome || "usuário"}`);
    let temporizador;
    const ocultar = () => {
      window.clearTimeout(temporizador);
      emailTexto.textContent = usuario.email || "—";
      revelar.textContent = "Revelar";
      revelar.dataset.revelado = "false";
    };
    revelar.addEventListener("click", async () => {
      if (revelar.dataset.revelado === "true") {
        ocultar();
        return;
      }
      revelar.disabled = true;
      try {
        const resposta = await apiFetch(
          `/api/admin/usuarios/${encodeURIComponent(usuario.id)}/revelar-email`,
          { method: "POST" },
        );
        const dados = await resposta.json();
        if (!resposta.ok || typeof dados.email !== "string") {
          revelar.title = dados.mensagem || "Não foi possível revelar o e-mail.";
          return;
        }
        let emailAberto = dados.email;
        emailTexto.textContent = emailAberto;
        emailAberto = "";
        revelar.textContent = "Ocultar";
        revelar.dataset.revelado = "true";
        temporizador = window.setTimeout(ocultar, 30000);
      } catch {
        revelar.title = "Não foi possível conectar ao servidor.";
      } finally {
        revelar.disabled = false;
      }
    });
    const conteudoEmail = document.createElement("div");
    conteudoEmail.className = "email-com-revelacao";
    conteudoEmail.append(revelar, emailTexto);
    celulaEmail.appendChild(conteudoEmail);
    linha.appendChild(celulaEmail);
    [
      perfilExibido,
      usuario.turma || "—",
      usuario.ativo ? "Ativo" : "Desativado",
    ].forEach((valor) => {
      const celula = document.createElement("td");
      celula.textContent = valor;
      linha.appendChild(celula);
    });
    const celula = document.createElement("td");
    const acoes = document.createElement("div");
    acoes.className = "acoes-usuarios";
    const botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = usuario.ativo ? "Desativar" : "Reativar";
    botao.dataset.usuarioId = usuario.id;
    botao.dataset.ativo = String(!usuario.ativo);
    if (usuario.id === adminAtualId) {
      botao.disabled = true;
      botao.title = "Você não pode desativar a própria conta.";
    }
    if (usuario.ativo && usuario.perfil !== "admin") {
      const decisoes =
        usuario.perfil === "professor"
          ? [["revogar", "Revogar acesso de professor"]]
          : usuario.solicitou_professor
            ? [
                ["aprovar", "Aprovar professor"],
                ["recusar", "Recusar solicitação"],
              ]
            : ["recusado", "revogado"].includes(usuario.status_professor)
              ? [["aprovar", "Liberar acesso de professor"]]
              : [];
      decisoes.forEach(([decisao, rotulo]) => {
        const acao = document.createElement("button");
        acao.type = "button";
        acao.textContent = rotulo;
        acao.dataset.usuarioId = usuario.id;
        acao.dataset.decisao = decisao;
        acoes.appendChild(acao);
      });
    }
    acoes.appendChild(botao);
    celula.appendChild(acoes);
    linha.appendChild(celula);
    corpo.appendChild(linha);
  });
  paginarTabela(corpo, "Páginas dos usuários");
}

async function carregarResumoAdmin() {
  const resposta = await apiFetch("/api/admin/resumo");
  if (!resposta.ok) return;
  const { resumo } = await resposta.json();
  document.querySelector("#turmas-admin").textContent = resumo.turmas;
  document.querySelector("#escolas-admin").textContent = resumo.escolas;
  document.querySelector("#partidas-admin").textContent = resumo.partidas;
}

document
  .querySelector("#corpo-usuarios")
  .addEventListener("click", async (evento) => {
    const botao = evento.target.closest("button[data-usuario-id]");
    if (!botao) return;
    botao.disabled = true;
    let resposta;
    try {
      resposta = await apiFetch(
        `/api/admin/usuarios/${botao.dataset.usuarioId}${botao.dataset.decisao ? "/professor" : ""}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            botao.dataset.decisao
              ? { decisao: botao.dataset.decisao }
              : { ativo: botao.dataset.ativo === "true" },
          ),
        },
      );
    } catch {
      botao.disabled = false;
      document.querySelector("#mensagem-usuarios").textContent =
        "Não foi possível conectar ao servidor.";
      return;
    }
    const resultado = await resposta.json();
    const status = document.querySelector("#mensagem-usuarios");
    status.textContent =
      resultado.mensagem ||
      (resposta.ok
        ? "Usuário atualizado."
        : "Não foi possível atualizar o usuário.");
    status.className = `mensagem ${resposta.ok ? "sucesso" : "erro"}`;
    if (resposta.ok) {
      carregarUsuarios();
      carregarAuditoria();
    } else botao.disabled = false;
  });
document
  .querySelector("#atualizar-usuarios")
  .addEventListener("click", carregarUsuarios);
document
  .querySelector("#abrir-usuarios-aprovacoes")
  .addEventListener("click", () => {
    document
      .querySelector('[data-painel-target="painel-admin-usuarios"]')
      .click();
  });
document
  .querySelector("#abrir-lista-perguntas-admin")
  .addEventListener("click", () => {
    document
      .querySelector('[data-painel-target="painel-admin-aprovacoes"]')
      .click();
  });

document.querySelector("#atualizar-auditoria").addEventListener("click", () => {
  paginaAuditoria = 0;
  cursoresAuditoria = [null];
  carregarAuditoria();
});
document
  .querySelector("#atualizar-solicitacoes")
  .addEventListener("click", carregarSolicitacoesPrivacidade);
document.querySelector("#sair").addEventListener("click", async () => {
  try {
    await apiFetch("/api/auth/sair", { method: "POST" });
  } finally {
    removerToken();
    window.location.replace("/");
  }
});
function atualizarPerguntasVisiveis() {
  if (!document.hidden) carregarPerguntas();
}

async function iniciarAdmin() {
  const sessao = await verificarSessaoPagina();
  if (!sessao) return;
  const { usuario } = sessao;
  adminAtualId = usuario.id;
  carregarPerguntas();
  document.querySelector("#atualizar-perguntas").addEventListener("click", carregarPerguntas);
  document.addEventListener("visibilitychange", atualizarPerguntasVisiveis);
  window.addEventListener("focus", atualizarPerguntasVisiveis);
  window.setInterval(atualizarPerguntasVisiveis, 10000);
  carregarUsuarios();
  carregarResumoAdmin();
  carregarAuditoria();
  carregarSolicitacoesPrivacidade();
}
iniciarAdmin();
