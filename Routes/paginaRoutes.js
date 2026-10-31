const router = require('express').Router();
const { pagina } = require('../Controller/paginaController');

router.get('/', pagina('login.html'));
router.get('/home', pagina('home.html'));
router.get('/termos', pagina('termos.html'));
router.get('/privacidade', pagina('privacidade.html'));
router.get('/alterar-senha', pagina('alterar-senha.html'));
router.get('/jogo', pagina('jogo.html'));
router.get('/sala', pagina('sala.html'));
router.get('/avaliacao', pagina('avaliacao.html'));
router.get('/admin', pagina('admin.html'));

module.exports = router;
