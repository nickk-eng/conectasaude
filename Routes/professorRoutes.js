const router = require('express').Router();
const professor = require('../Controller/professorController');
const { autenticar, permitir } = require('../Middleware/autenticacao');

router.get('/alunos', autenticar, permitir('professor', 'admin'), professor.listarAlunos);
router.put('/alunos/:id/responsaveis', autenticar, permitir('professor', 'admin'), professor.atualizarResponsaveisAluno);
router.get('/avaliacoes', autenticar, permitir('professor', 'admin'), professor.listarAvaliacoes);
router.get('/indicadores-ists', autenticar, permitir('professor', 'admin'), professor.indicadoresIsts);
router.get('/relatorios', autenticar, permitir('professor'), professor.relatorios);
router.post('/perguntas', autenticar, permitir('professor'), professor.criarPergunta);

module.exports = router;
