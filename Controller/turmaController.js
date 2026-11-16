const turmaModel = require("../Model/turmaModel");
const { registrarAuditoria } = require("../Service/auditoriaService");

const idValido = (id) =>
  typeof id === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
const limparNome = (valor) =>
  typeof valor === "string"
    ? valor.normalize("NFC").trim().replace(/\s+/g, " ")
    : "";

async function listar(req, res) {
  res.json(await turmaModel.listar(req.usuario.id));
}

async function criar(req, res) {
  const {
    ano,
    letra,
    escolaId,
    escola,
    confirmarEscola,
    descricao = "",
  } = req.body;
  const anoNumero =
    typeof ano === "number" || typeof ano === "string" ? Number(ano) : NaN;
  const letraLimpa =
    typeof letra === "string" ? letra.trim().toUpperCase() : "";
  const escolaLimpa = limparNome(escola);
  if (![1, 2, 3].includes(anoNumero) || !/^[A-Z]$/.test(letraLimpa)) {
    return res
      .status(400)
      .json({
        mensagem:
          "Selecione o 1º, 2º ou 3º ano e informe uma letra de A a Z para a turma.",
      });
  }
  const escolaExistente = escolaId !== undefined && escolaId !== "";
  if (escolaExistente && !idValido(escolaId))
    return res
      .status(400)
      .json({ mensagem: "Selecione uma escola cadastrada válida." });
  if (
    !escolaExistente &&
    (!escolaLimpa ||
      escolaLimpa.length > 150 ||
      escolaLimpa.toLocaleLowerCase("pt-BR") !==
        limparNome(confirmarEscola).toLocaleLowerCase("pt-BR"))
  ) {
    return res
      .status(400)
      .json({
        mensagem:
          "Informe o nome da escola com até 150 caracteres e confirme o mesmo nome.",
      });
  }
  if (typeof descricao !== "string" || descricao.trim().length > 1000)
    return res
      .status(400)
      .json({ mensagem: "A descrição deve ter no máximo 1.000 caracteres." });
  try {
    const turma = await turmaModel.criar(req.usuario.id, {
      ano: anoNumero,
      letra: letraLimpa,
      escolaId: escolaExistente ? escolaId : null,
      escola: escolaLimpa,
      descricao: descricao.trim(),
    });
    if (!turma)
      return res
        .status(404)
        .json({
          mensagem:
            "A escola selecionada não está disponível para seu cadastro.",
        });
    await registrarAuditoria(req, "turma_criada", "turmas", {
      turmaId: turma.id,
    });
    res.status(201).json({ mensagem: "Turma criada com sucesso.", turma });
  } catch (erro) {
    if (erro.code === "23505")
      return res
        .status(409)
        .json({ mensagem: "Você já cadastrou essa turma nessa escola." });
    throw erro;
  }
}

async function pesquisar(req, res) {
  const busca = req.query.busca === undefined ? "" : req.query.busca;
  const vinculo = req.query.vinculo === undefined ? "minha" : req.query.vinculo;
  const pagina = req.query.pagina === undefined ? "1" : req.query.pagina;
  if (
    !idValido(req.params.turmaId) ||
    typeof busca !== "string" ||
    busca.length > 150 ||
    !["minha", "disponiveis"].includes(vinculo) ||
    typeof pagina !== "string" ||
    !/^[1-9]\d{0,5}$/.test(pagina)
  ) {
    return res
      .status(400)
      .json({ mensagem: "Informe filtros de busca válidos." });
  }
  const dados = await turmaModel.pesquisar(req.usuario.id, {
    turmaId: req.params.turmaId,
    busca: busca.trim(),
    vinculo,
    pagina: Number(pagina),
  });
  if (!dados)
    return res.status(404).json({ mensagem: "Turma não encontrada." });
  res.json(dados);
}

async function alterar(req, res) {
  const alunoId = String(req.params.id || "");
  const turmaId = req.params.turmaId;
  if (!idValido(turmaId) || !idValido(alunoId)) {
    return res.status(400).json({ mensagem: "Turma ou aluno inválido." });
  }
  if (!(await turmaModel.buscar(req.usuario.id, turmaId)))
    return res.status(404).json({ mensagem: "Turma não encontrada." });
  const adicionar = req.method === "PUT";
  if (adicionar) {
    if (!(await turmaModel.adicionar(req.usuario.id, turmaId, alunoId))) {
      return res
        .status(409)
        .json({
          mensagem:
            "O aluno deve estar ativo e pertencer ao mesmo ano escolar da turma.",
        });
    }
  } else {
    await turmaModel.remover(req.usuario.id, turmaId, alunoId);
  }
  await registrarAuditoria(
    req,
    adicionar ? "aluno_adicionado_turma" : "aluno_removido_turma",
    "turma_alunos",
    { turmaId, alunoId },
  );
  res.json({
    mensagem: adicionar
      ? "Aluno adicionado à sua turma."
      : "Aluno removido da sua turma.",
  });
}

function rotaAntiga(_req, res) {
  res
    .status(410)
    .json({
      mensagem:
        "Crie ou selecione uma turma em Gerenciar minhas turmas para gerenciar os alunos.",
    });
}

module.exports = { listar, criar, pesquisar, alterar, rotaAntiga };
