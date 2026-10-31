const app = require('./app');
const { prepararBanco, criarAdmin } = require('./db/inicializar');

const PORTA = process.env.PORT || 3000;

prepararBanco()
  .then(criarAdmin)
  .then(() =>
    app.listen(PORTA, () => console.log(`ConectaSaúde rodando em http://localhost:${PORTA}`))
  )
  .catch((erro) => {
    console.error('Erro ao preparar o banco de dados:', erro.message);
    process.exit(1);
  });
