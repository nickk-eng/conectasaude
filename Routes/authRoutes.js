const router = require('express').Router();
const auth = require('../Controller/authController');
const { autenticar } = require('../Middleware/autenticacao');

router.post('/cadastro', auth.cadastro);
router.post('/login', auth.login);
router.post('/verificar-totp', auth.verificarTotp);
router.post('/recuperar-senha', auth.recuperarSenha);
router.post('/encerrar-conta', autenticar, auth.encerrarConta);
router.post('/sair', autenticar, auth.sair);
router.get('/eu', autenticar, auth.eu);

module.exports = router;
