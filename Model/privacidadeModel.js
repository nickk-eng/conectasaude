const banco = require("../Config/banco");
const usuarioModel = require("./usuarioModel");

async function criar({ usuarioId, tipo, mensagem }) {
  const resultado = await banco.query(
    "INSERT INTO solicitacoes_privacidade (usuario_id, tipo, mensagem) VALUES ($1, $2, $3) RETURNING id",
    [usuarioId, tipo, mensagem],
  );
  return resultado.rows[0].id;
}

async function listar() {
  const dados = await banco.query(
    `SELECT s.id, s.tipo, s.mensagem, s.status, s.criado_em, s.resposta, s.respondida_em,
            s.providencia, s.comprovante, s.verificada_em,
            CASE WHEN u.id IS NULL OR u.ativo = FALSE THEN 'Conta encerrada ou indisponível'
                 ELSE COALESCE(NULLIF(u.nome, ''), u.email) END AS solicitante
       FROM solicitacoes_privacidade s
       LEFT JOIN usuarios u ON u.id = s.usuario_id
      ORDER BY s.criado_em DESC, s.id DESC`,
  );
  return dados.rows;
}

async function listarDoUsuario(usuarioId) {
  const dados = await banco.query(
    "SELECT id, tipo, mensagem, status, criado_em, resposta, respondida_em, providencia, comprovante, verificada_em FROM solicitacoes_privacidade WHERE usuario_id = $1 ORDER BY criado_em DESC, id DESC",
    [usuarioId],
  );
  return dados.rows;
}

async function responder(
  id,
  status,
  resposta,
  adminId,
  { providencia, comprovante, confirmarEliminacao } = {},
) {
  const cliente = await banco.connect();
  try {
    await cliente.query("BEGIN");
    const dados = await cliente.query(
      "SELECT id, usuario_id, tipo, status FROM solicitacoes_privacidade WHERE id = $1 FOR UPDATE",
      [id],
    );
    const pedido = dados.rows[0];
    if (!pedido) {
      await cliente.query("ROLLBACK");
      return null;
    }
    if (["concluida", "recusada"].includes(pedido.status)) {
      throw Object.assign(
        new Error(
          "Este pedido já foi finalizado. Registre um novo pedido para outro atendimento.",
        ),
        { status: 409 },
      );
    }
    let usuarioEliminado = null;
    if (status === "concluida" && pedido.tipo === "eliminacao") {
      if (confirmarEliminacao !== true || !pedido.usuario_id) {
        throw Object.assign(
          new Error(
            "Confirme a exclusão definitiva da conta para concluir este pedido de eliminação.",
          ),
          { status: 400 },
        );
      }
      usuarioEliminado = pedido.usuario_id;
      await usuarioModel.eliminarDadosConta(cliente, usuarioEliminado, {
        solicitacaoPreservada: id,
      });
      resposta =
        "Conta e registros vinculados eliminados do banco ativo. Consulte a política para conhecer os limites da exclusão de conteúdo e de cópias de segurança.";
      providencia =
        "Exclusão transacional de conta, credenciais, vínculos, resultados, pedidos e registros de acesso associados.";
      comprovante = `Exclusão executada pelo sistema na transação do pedido ${id}.`;
    }
    const atualizado = await cliente.query(
      `UPDATE solicitacoes_privacidade SET status = $2::text, resposta = $3, respondida_em = NOW(), respondida_por = $4,
       providencia = $5, comprovante = $6, verificada_em = CASE WHEN $2::text = 'concluida' THEN NOW() ELSE NULL END
       WHERE id = $1 RETURNING id`,
      [id, status, resposta, adminId, providencia || "", comprovante || ""],
    );
    await cliente.query("COMMIT");
    return { ...atualizado.rows[0], usuarioEliminado };
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
}

module.exports = { criar, listar, listarDoUsuario, responder };
