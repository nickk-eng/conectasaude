const router = require('express').Router();
const { pagina } = require('../Controller/paginaController');
const { protegerPagina } = require('../Middleware/autenticacao');

router.get('/', pagina('login.html'));
router.get('/home', protegerPagina('aluno', 'professor'), pagina('home.html'));
router.get('/termos', pagina('termos.html'));
router.get('/privacidade', pagina('privacidade.html'));
router.get('/alterar-senha', pagina('alterar-senha.html'));
router.get('/nova-senha', pagina('nova-senha.html'));
router.get('/jogo', protegerPagina('aluno'), pagina('jogo.html'));
router.get('/sala', protegerPagina('aluno'), pagina('sala.html'));
router.get('/avaliacao', protegerPagina('aluno'), pagina('avaliacao.html'));
router.get('/admin', protegerPagina('admin'), pagina('admin.html'));

module.exports = router;
