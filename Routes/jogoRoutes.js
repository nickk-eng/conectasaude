const router = require('express').Router();
const jogo = require('../Controller/jogoController');
const { autenticar, permitir } = require('../Middleware/autenticacao');
const { exigirPreTeste } = require('../Middleware/avaliacao');

router.use(autenticar, permitir('aluno'));

router.get('/perguntas', exigirPreTeste, jogo.listarPerguntas);
router.post('/resultado', exigirPreTeste, jogo.registrarResultado);

module.exports = router;
