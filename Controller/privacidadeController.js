const privacidadeModel = require("../Model/privacidadeModel");
const { registrarAuditoria } = require("../Service/auditoriaService");
const { TIPOS_SOLICITACAO_PRIVACIDADE } = require("../Config/constantes");
const salas = require("../Service/salasAtivas");

async function criarSolicitacao(req, res) {
  const tipo = String(req.body.tipo || "");
  const mensagem = String(req.body.mensagem || "")
    .trim()
    .slice(0, 1000);

  if (!TIPOS_SOLICITACAO_PRIVACIDADE.includes(tipo)) {
    return res
      .status(400)
      .json({ mensagem: "Selecione um tipo de solicitação válido." });
  }

  try {
    const solicitacaoId = await privacidadeModel.criar({
      usuarioId: req.usuario.id,
      tipo,
      mensagem,
    });
    await registrarAuditoria(
      req,
      "solicitacao_privacidade_criada",
      "privacidade",
      { solicitacaoId, tipo },
    );
    res
      .status(201)
      .json({
        mensagem: "Solicitação registrada para análise da equipe do projeto.",
      });
  } catch (erro) {
    console.error(
      "Erro ao registrar solicitação de privacidade:",
      erro.message,
    );
    res
      .status(503)
      .json({
        mensagem: "Não foi possível registrar a solicitação. Tente novamente.",
      });
  }
}

async function minhasSolicitacoes(req, res) {
  res.json({
    solicitacoes: await privacidadeModel.listarDoUsuario(req.usuario.id),
  });
}

async function responderSolicitacao(req, res) {
  const status = String(req.body.status || "");
  const resposta = String(req.body.resposta || "").trim();
  const providencia = String(req.body.providencia || "").trim();
  const comprovante = String(req.body.comprovante || "").trim();
  if (
    !/^[1-9][0-9]{0,18}$/.test(req.params.id) ||
    !["recebida", "em_analise", "concluida", "recusada"].includes(status)
  ) {
    return res
      .status(400)
      .json({ mensagem: "Informe uma solicitação e um status válidos." });
  }
  if (
    resposta.length > 2000 ||
    (["concluida", "recusada"].includes(status) && !resposta)
  ) {
    return res
      .status(400)
      .json({
        mensagem:
          "Para concluir ou recusar, escreva uma resposta de até 2.000 caracteres.",
      });
  }
  if (
    providencia.length > 2000 ||
    comprovante.length > 500 ||
    (status === "concluida" &&
      (providencia.length < 20 ||
        comprovante.length < 8 ||
        req.body.confirmouAtendimento !== true))
  ) {
    return res
      .status(400)
      .json({
        mensagem:
          "Para concluir, descreva a providência (20 a 2.000 caracteres), informe a referência de comprovação (8 a 500 caracteres) e confirme o atendimento. Não inclua senhas, códigos ou dados de terceiros.",
      });
  }
  let pedido;
  try {
    pedido = await privacidadeModel.responder(
      req.params.id,
      status,
      resposta,
      req.usuario.id,
      {
        providencia,
        comprovante,
        confirmarEliminacao: req.body.confirmarEliminacao === true,
      },
    );
  } catch (erro) {
    if (erro.status)
      return res.status(erro.status).json({ mensagem: erro.message });
    throw erro;
  }
  if (!pedido) {
    return res.status(404).json({ mensagem: "Solicitação não encontrada." });
  }
  if (pedido.usuarioEliminado) salas.removerDoUsuario(pedido.usuarioEliminado);
  await registrarAuditoria(
    req,
    "solicitacao_privacidade_respondida",
    "privacidade",
    { solicitacaoId: req.params.id, status },
  );
  res.json({ mensagem: "Resposta e status atualizados." });
}

module.exports = { criarSolicitacao, minhasSolicitacoes, responderSolicitacao };
