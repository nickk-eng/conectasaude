const router = require('express').Router();
const avaliacao = require('../Controller/avaliacaoController');
const { autenticar, permitir } = require('../Middleware/autenticacao');

router.use(autenticar, permitir('aluno'));

router.get('/status', avaliacao.status);
router.get('/:tipo', avaliacao.iniciar);
router.post('/:tipo/respostas', avaliacao.responder);

module.exports = router;
