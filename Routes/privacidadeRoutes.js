const router = require("express").Router();
const privacidade = require("../Controller/privacidadeController");
const { autenticarSessao } = require("../Middleware/autenticacao");

router.post("/solicitacoes", autenticarSessao, privacidade.criarSolicitacao);
router.get("/solicitacoes", autenticarSessao, privacidade.minhasSolicitacoes);

module.exports = router;
