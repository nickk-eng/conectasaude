const app = require("./app");
const { prepararBanco, criarAdmin } = require("./db/inicializar");
const { conectarSalasWebSocket } = require("./Service/salaWebSocket");

const PORTA = process.env.PORT || 3000;

prepararBanco()
  .then(criarAdmin)
  .then(() => {
    const servidor = app.listen(PORTA, () =>
      console.log(`ConectaSaúde rodando em http://localhost:${PORTA}`),
    );
    conectarSalasWebSocket(servidor);
  })
  .catch((erro) => {
    console.error("Erro ao preparar o banco de dados:", erro.message);
    process.exit(1);
  });
