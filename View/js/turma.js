const filtrosTurma = document.querySelector("#filtros-turma");
const buscaAluno = document.querySelector("#busca-aluno");
const vinculoAluno = document.querySelector("#vinculo-aluno");
const mensagemTurma = document.querySelector("#mensagem-turma");
const resultadoTurma = document.querySelector("#resultado-turma");
const alunosTurma = document.querySelector("#alunos-turma");
const vazioTurma = document.querySelector("#vazio-turma");
const anteriorTurma = document.querySelector("#anterior-turma");
const proximaTurma = document.querySelector("#proxima-turma");
const tentarTurma = document.querySelector("#tentar-turma");
let paginaTurma = 1;
let consultaTurma = 0;
let tempoBusca;
let alterandoTurma = false;
let turmaSelecionada = null;
let consultaDiretorio = 0;
const diretorioTurmas = document.querySelector("#diretorio-turmas");
const gestaoAlunos = document.querySelector("#gestao-alunos");
const cadastroTurma = document.querySelector("#cadastro-turma");
const formCriarTurma = document.querySelector("#form-criar-turma");
const mensagemDiretorio = document.querySelector("#mensagem-diretorio");
const escolaTurma = document.querySelector("#escola-turma");
let criandoTurma = false;

function atualizarCamposEscola() {
  const nova = escolaTurma.value === "nova";
  document.querySelector("#campo-nome-escola").hidden = !nova;
  document.querySelector("#campo-confirmar-escola").hidden = !nova;
  for (const campo of [
    document.querySelector("#nome-nova-escola"),
    document.querySelector("#confirmar-nova-escola"),
  ]) {
    campo.disabled = !nova || criandoTurma;
    campo.required = nova;
  }
}

function preencherEscolas(escolas) {
  const selecionada = escolaTurma.value;
  escolaTurma.replaceChildren();
  const orientacao = document.createElement("option");
  orientacao.value = "";
  orientacao.textContent = "Selecione uma escola";
  escolaTurma.append(orientacao);
  escolas.forEach((escola) => {
    const opcao = document.createElement("option");
    opcao.value = escola.id;
    opcao.textContent = escola.nome;
    escolaTurma.append(opcao);
  });
  const nova = document.createElement("option");
  nova.value = "nova";
  nova.textContent = "Cadastrar nova escola";
  escolaTurma.append(nova);
  escolaTurma.value =
    selecionada === "nova" ||
    escolas.some((escola) => escola.id === selecionada)
      ? selecionada
      : escolas.length
        ? ""
        : "nova";
  atualizarCamposEscola();
}

escolaTurma.addEventListener("change", atualizarCamposEscola);

async function carregarDiretorio(aviso = "") {
  const consulta = ++consultaDiretorio;
  const tentar = document.querySelector("#tentar-diretorio");
  const escolas = document.querySelector("#escolas-turmas");
  mensagemDiretorio.textContent = aviso || "Carregando turmas…";
  tentar.hidden = true;
  try {
    const resposta = await apiFetch("/api/professor/turmas");
    const dados = await resposta.json();
    if (consulta !== consultaDiretorio) return;
    if (!resposta.ok)
      throw new Error(dados.mensagem || "Não foi possível carregar as turmas.");
    preencherEscolas(dados.escolas);
    document.querySelector("#abrir-criar-turma").disabled = false;
    escolas.replaceChildren();
    const grupos = new Map();
    dados.turmas.forEach((turma) => {
      const chave = turma.escolaId;
      if (!grupos.has(chave)) {
        const secao = document.createElement("section");
        secao.className = "escola-turmas";
        const titulo = document.createElement("h2");
        titulo.textContent = turma.escola;
        const botoes = document.createElement("div");
        botoes.className = "botoes-turmas";
        secao.append(titulo, botoes);
        escolas.append(secao);
        grupos.set(chave, botoes);
      }
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "botao-turma";
      const nome = document.createElement("strong");
      nome.textContent = `Turma ${turma.nome}`;
      const total = document.createElement("span");
      total.textContent = `${turma.totalAlunos} aluno(s)`;
      botao.append(nome, total);
      botao.setAttribute(
        "aria-label",
        `Abrir turma ${turma.nome} da escola ${turma.escola}`,
      );
      botao.addEventListener("click", () => abrirTurma(turma));
      grupos.get(chave).append(botao);
    });
    mensagemDiretorio.textContent =
      aviso ||
      (dados.turmas.length
        ? ""
        : "Você ainda não criou turmas. Clique em “Criar turma” para começar.");
    const antigos = document.querySelector("#aviso-alunos-antigos");
    antigos.hidden = !dados.alunosSemTurma;
    antigos.textContent = `Você tem ${dados.alunosSemTurma} aluno(s) de vínculos anteriores ainda sem turma definida. Eles continuam no seu painel. Crie as turmas e adicione esses alunos pelo ano correspondente para organizá-los.`;
  } catch (erro) {
    if (consulta !== consultaDiretorio) return;
    mensagemDiretorio.textContent = aviso
      ? `${aviso} Não foi possível atualizar a lista. Tente novamente.`
      : erro.message || "Não foi possível conectar ao servidor.";
    tentar.hidden = false;
  }
}

function abrirTurma(turma) {
  turmaSelecionada = turma;
  diretorioTurmas.hidden = true;
  gestaoAlunos.hidden = false;
  buscaAluno.value = "";
  vinculoAluno.value = "minha";
  document.querySelector("#escola-selecionada").textContent = turma.escola;
  document.querySelector("#titulo-alunos").textContent = `Turma ${turma.nome}`;
  const descricao = document.querySelector("#descricao-selecionada");
  descricao.textContent = turma.descricao;
  descricao.hidden = !turma.descricao;
  document.querySelector("#orientacao-ano").textContent =
    `Ao adicionar alunos, serão apresentados os cadastros do ${turma.ano}º ano do ensino médio.`;
  carregarTurma();
}

document.querySelector("#voltar-turmas").addEventListener("click", () => {
  if (alterandoTurma) return;
  ++consultaTurma;
  clearTimeout(tempoBusca);
  turmaSelecionada = null;
  diretorioTurmas.hidden = false;
  gestaoAlunos.hidden = true;
  carregarDiretorio();
});
document.querySelector("#abrir-criar-turma").addEventListener("click", () => {
  cadastroTurma.hidden = false;
  document.querySelector("#ano-turma").focus();
});
document
  .querySelector("#cancelar-criar-turma")
  .addEventListener("click", () => {
    cadastroTurma.hidden = true;
    formCriarTurma.reset();
    document.querySelector("#mensagem-criar-turma").textContent = "";
    atualizarNomeTurma();
    atualizarCamposEscola();
  });
function atualizarNomeTurma() {
  const ano = document.querySelector("#ano-turma").value;
  const letra = document.querySelector("#letra-turma").value.toUpperCase();
  document.querySelector("#previa-nome-turma").textContent =
    ano && /^[A-Z]$/.test(letra)
      ? `Nome da turma: ${ano}${letra}`
      : "Escolha o ano e a letra para identificar a turma.";
}
document
  .querySelector("#ano-turma")
  .addEventListener("change", atualizarNomeTurma);
document
  .querySelector("#letra-turma")
  .addEventListener("input", atualizarNomeTurma);
document
  .querySelector("#tentar-diretorio")
  .addEventListener("click", () => carregarDiretorio());
formCriarTurma.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const campos = [...formCriarTurma.elements];
  if (criandoTurma) return;
  const dados = new FormData(formCriarTurma);
  const mensagem = document.querySelector("#mensagem-criar-turma");
  const normalizar = (valor) =>
    String(valor)
      .normalize("NFC")
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase("pt-BR");
  if (
    escolaTurma.value === "nova" &&
    normalizar(dados.get("escola")) !== normalizar(dados.get("confirmarEscola"))
  ) {
    mensagem.textContent =
      "Os nomes da escola não são iguais. Confira os dois campos.";
    return;
  }
  const corpo = Object.fromEntries(dados);
  if (corpo.escolaId === "nova") delete corpo.escolaId;
  criandoTurma = true;
  campos.forEach((campo) => {
    campo.disabled = true;
  });
  mensagem.textContent = "Criando turma…";
  try {
    const resposta = await apiFetch("/api/professor/turmas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const resultado = await resposta.json();
    if (!resposta.ok)
      throw new Error(resultado.mensagem || "Não foi possível criar a turma.");
    formCriarTurma.reset();
    atualizarNomeTurma();
    cadastroTurma.hidden = true;
    mensagem.textContent = "";
    await carregarDiretorio(
      `Turma ${resultado.turma.nome} criada. Clique no botão da turma abaixo para adicionar alunos.`,
    );
  } catch (erro) {
    mensagem.textContent =
      erro.message || "Não foi possível conectar ao servidor.";
  } finally {
    criandoTurma = false;
    campos.forEach((campo) => {
      campo.disabled = false;
    });
    atualizarCamposEscola();
  }
});

async function carregarTurma(pagina = 1, aviso = "") {
  if (alterandoTurma || !turmaSelecionada) return;
  clearTimeout(tempoBusca);
  const consulta = ++consultaTurma;
  const parametros = new URLSearchParams({
    busca: buscaAluno.value.trim(),
    vinculo: vinculoAluno.value,
    pagina,
  });
  paginaTurma = pagina;
  resultadoTurma.hidden = true;
  resultadoTurma.setAttribute("aria-busy", "true");
  tentarTurma.hidden = true;
  mensagemTurma.textContent = aviso || "Carregando alunos…";
  mensagemTurma.className = "mensagem";
  try {
    const resposta = await apiFetch(
      `/api/professor/turmas/${turmaSelecionada.id}/alunos?${parametros}`,
    );
    const dados = await resposta.json();
    if (consulta !== consultaTurma) return;
    if (!resposta.ok)
      throw new Error(dados.mensagem || "Não foi possível carregar os alunos.");
    if (pagina > 1 && dados.alunos.length === 0)
      return carregarTurma(pagina - 1, aviso);
    alunosTurma.replaceChildren();
    dados.alunos.forEach((aluno) => {
      const linha = document.createElement("tr");
      [aluno.nome || "Nome não informado"].forEach((valor) => {
        const celula = document.createElement("td");
        celula.textContent = valor;
        linha.append(celula);
      });
      const celulaEmail = document.createElement("td");
      const emailTexto = document.createElement("span");
      emailTexto.textContent = aluno.email || "—";
      const revelar = document.createElement("button");
      revelar.type = "button";
      revelar.className = "botao-revelar-email";
      revelar.textContent = "Revelar";
      revelar.setAttribute("aria-label", `Revelar e-mail de ${aluno.nome || "aluno"}`);
      let temporizador;
      const ocultar = () => {
        window.clearTimeout(temporizador);
        emailTexto.textContent = aluno.email || "—";
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
            `/api/professor/alunos/${encodeURIComponent(aluno.id)}/revelar-email`,
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
      linha.append(celulaEmail);
      const celulaTurma = document.createElement("td");
      celulaTurma.textContent = aluno.turma || "Não informado";
      linha.append(celulaTurma);
      const acao = document.createElement("td");
      const botao = document.createElement("button");
      botao.type = "button";
      botao.textContent = aluno.vinculado
        ? "Remover da turma"
        : "Adicionar à turma";
      botao.setAttribute(
        "aria-label",
        `${botao.textContent}: ${aluno.nome || aluno.email}`,
      );
      botao.addEventListener("click", () => alterarVinculo(aluno));
      acao.append(botao);
      linha.append(acao);
      alunosTurma.append(linha);
    });
    vazioTurma.hidden = dados.alunos.length > 0;
    vazioTurma.textContent = buscaAluno.value.trim()
      ? "Nenhum aluno encontrado com essa busca."
      : vinculoAluno.value === "minha"
        ? "Sua turma ainda está vazia. Escolha “Adicionar alunos cadastrados” para começar."
        : "Não há outros alunos cadastrados disponíveis para adicionar.";
    anteriorTurma.disabled = pagina <= 1;
    proximaTurma.disabled = !dados.temMais;
    document.querySelector("#pagina-turma").textContent = `Página ${pagina}`;
    mensagemTurma.textContent = aviso;
    resultadoTurma.hidden = false;
  } catch (erro) {
    if (consulta !== consultaTurma) return;
    mensagemTurma.textContent = aviso
      ? `${aviso} Não foi possível atualizar a lista. Tente novamente.`
      : erro.message || "Não foi possível conectar ao servidor.";
    mensagemTurma.className = "mensagem erro";
    tentarTurma.hidden = false;
  } finally {
    if (consulta === consultaTurma)
      resultadoTurma.setAttribute("aria-busy", "false");
  }
}

async function alterarVinculo(aluno) {
  if (alterandoTurma) return;
  alterandoTurma = true;
  clearTimeout(tempoBusca);
  const botoes = [
    ...document.querySelectorAll(
      ".gestao-turma button, .filtros-turma input, .filtros-turma select",
    ),
  ];
  const estados = botoes.map((botao) => botao.disabled);
  botoes.forEach((botao) => {
    botao.disabled = true;
  });
  mensagemTurma.textContent = "Salvando alteração…";
  let aviso = "";
  try {
    const resposta = await apiFetch(
      `/api/professor/turmas/${turmaSelecionada.id}/alunos/${aluno.id}`,
      { method: aluno.vinculado ? "DELETE" : "PUT" },
    );
    const dados = await resposta.json();
    if (!resposta.ok)
      throw new Error(dados.mensagem || "Não foi possível alterar a turma.");
    aviso = dados.mensagem;
  } catch (erro) {
    mensagemTurma.textContent =
      erro.message || "Não foi possível conectar ao servidor. Tente novamente.";
    mensagemTurma.className = "mensagem erro";
  } finally {
    alterandoTurma = false;
    botoes.forEach((botao, indice) => {
      botao.disabled = estados[indice];
    });
  }
  if (aviso) await carregarTurma(paginaTurma, aviso);
}

filtrosTurma.addEventListener("submit", (evento) => {
  evento.preventDefault();
  carregarTurma();
});
buscaAluno.addEventListener("input", () => {
  ++consultaTurma;
  resultadoTurma.hidden = true;
  clearTimeout(tempoBusca);
  tempoBusca = setTimeout(() => carregarTurma(), 300);
});
vinculoAluno.addEventListener("change", () => carregarTurma());
anteriorTurma.addEventListener("click", () => carregarTurma(paginaTurma - 1));
proximaTurma.addEventListener("click", () => carregarTurma(paginaTurma + 1));
tentarTurma.addEventListener("click", () => carregarTurma(paginaTurma));

async function iniciarTurma() {
  try {
    const sessao = await verificarSessaoPagina();
    if (!sessao) return;
    const { usuario } = sessao;
    document.querySelector("#nome-professor").textContent =
      `Professor(a): ${usuario.nome || usuario.email}`;
    await carregarDiretorio();
  } catch {
    mensagemTurma.textContent =
      "Não foi possível carregar a página. Atualize para tentar novamente.";
  }
}

iniciarTurma();
