const router = require('express').Router();
const auth = require('../Controller/authController');
const { autenticar } = require('../Middleware/autenticacao');
const { limiteRecuperacao } = require('../Middleware/limiteRecuperacao');

router.post('/cadastro', auth.cadastro);
router.post('/login', auth.login);
router.post('/verificar-totp', auth.verificarTotp);
router.post('/solicitar-recuperacao', limiteRecuperacao, auth.solicitarRecuperacao);
router.post('/verificar-codigo-recuperacao', limiteRecuperacao, auth.verificarCodigoRecuperacao);
router.post('/recuperar-senha', limiteRecuperacao, auth.recuperarSenha);
router.post('/encerrar-conta', autenticar, auth.encerrarConta);
router.post('/sair', autenticar, auth.sair);
router.get('/eu', autenticar, auth.eu);

module.exports = router;
