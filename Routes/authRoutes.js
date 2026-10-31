const router = require('express').Router();
const auth = require('../Controller/authController');
const { autenticar } = require('../Middleware/autenticacao');
const { limitarTentativas } = require('../Middleware/limiteTentativas');
const { limiteRecuperacao } = require('../Middleware/limiteRecuperacao');

router.post('/cadastro', limitarTentativas(20), auth.cadastro);
router.post('/login', limitarTentativas(30), auth.login);
router.post('/verificar-totp', limitarTentativas(30), auth.verificarTotp);
router.post('/solicitar-recuperacao', limiteRecuperacao, auth.solicitarRecuperacao);
router.post('/verificar-codigo-recuperacao', limiteRecuperacao, auth.verificarCodigoRecuperacao);
router.post('/recuperar-senha', limiteRecuperacao, auth.recuperarSenha);
router.post('/encerrar-conta', autenticar, auth.encerrarConta);
router.post('/sair', autenticar, auth.sair);
router.get('/eu', autenticar, auth.eu);

module.exports = router;
