const { WebSocket, WebSocketServer } = require("ws");
const { buscarUsuarioDaSessao } = require("../Middleware/autenticacao");
const { preTesteConcluido } = require("./avaliacaoService");
const salas = require("./salasAtivas");

function conectarSalasWebSocket(servidor) {
  const conexoes = new WebSocketServer({ noServer: true, maxPayload: 1024 });

  servidor.on("upgrade", (req, socket, head) => {
    if (req.url !== "/api/salas/tempo-real") {
      socket.destroy();
      return;
    }
    conexoes.handleUpgrade(req, socket, head, (cliente) => {
      conexoes.emit("connection", cliente);
    });
  });

  conexoes.on("connection", (cliente) => {
    let cancelarInscricao;
    const prazoAutenticacao = setTimeout(() => cliente.terminate(), 8000);
    cliente.vivo = true;
    cliente.on("pong", () => { cliente.vivo = true; });
    cliente.on("error", () => cliente.terminate());
    cliente.on("close", () => {
      clearTimeout(prazoAutenticacao);
      cancelarInscricao?.();
    });

    cliente.once("message", async (mensagem) => {
      try {
        const { token, codigo, partida } = JSON.parse(mensagem.toString());
        if (typeof codigo !== "string" || !/^[0-9]{1,8}$/.test(codigo) ||
            typeof partida !== "string" || partida.length !== 36) {
          cliente.close(1008);
          return;
        }
        const usuario = await buscarUsuarioDaSessao(token);
        if (usuario?.perfil !== "aluno" || !(await preTesteConcluido(usuario.id))) {
          cliente.close(1008);
          return;
        }
        if (cliente.readyState !== WebSocket.OPEN) return;
        const atualizar = () => {
          if (cliente.readyState === WebSocket.OPEN) cliente.send("atualizar");
        };
        cancelarInscricao = salas.assinar(usuario, codigo, partida, atualizar);
        clearTimeout(prazoAutenticacao);
        atualizar();
      } catch (erro) {
        cliente.close(erro.status || erro instanceof SyntaxError ? 1008 : 1011);
      }
    });
  });

  const heartbeat = setInterval(() => {
    for (const cliente of conexoes.clients) {
      if (cliente.readyState !== WebSocket.OPEN) continue;
      if (!cliente.vivo) cliente.terminate();
      else {
        cliente.vivo = false;
        cliente.ping();
      }
    }
  }, 25000);
  heartbeat.unref();
  servidor.once("close", () => {
    clearInterval(heartbeat);
    for (const cliente of conexoes.clients) cliente.terminate();
    conexoes.close();
  });
}

module.exports = { conectarSalasWebSocket };
