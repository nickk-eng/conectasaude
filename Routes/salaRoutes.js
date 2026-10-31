const router = require('express').Router();
const sala = require('../Controller/salaController');
const { autenticar, permitir } = require('../Middleware/autenticacao');
const { exigirPreTeste } = require('../Middleware/avaliacao');

router.use(autenticar, permitir('aluno'), exigirPreTeste);
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.post('/', sala.criar);
router.post('/entrar', sala.entrar);
router.get('/:codigo', sala.consultar);
router.post('/:codigo/acoes', sala.agir);

module.exports = router;
