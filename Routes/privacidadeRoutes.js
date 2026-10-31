const router = require('express').Router();
const privacidade = require('../Controller/privacidadeController');
const { autenticar } = require('../Middleware/autenticacao');

router.post('/solicitacoes', autenticar, privacidade.criarSolicitacao);

module.exports = router;
