const router = require('express').Router();
const usuario = require('../Controller/usuarioController');
const { autenticar, permitir } = require('../Middleware/autenticacao');

router.put('/usuario/perfil', autenticar, permitir('aluno', 'professor'), usuario.atualizarPerfil);
router.post('/usuario/solicitacao-professor', autenticar, permitir('aluno'), usuario.solicitarProfessor);
router.put('/aluno/perfil', autenticar, permitir('aluno'), usuario.atualizarPerfilAluno);
router.get('/aluno/historico', autenticar, permitir('aluno'), usuario.historico);

module.exports = router;
