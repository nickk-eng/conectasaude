const router = require('express').Router();

router.use('/api/auth', require('./authRoutes'));
router.use('/api', require('./usuarioRoutes'));
router.use('/api/privacidade', require('./privacidadeRoutes'));
router.use('/api/professor', require('./professorRoutes'));
router.use('/api/admin', require('./adminRoutes'));
router.use('/api/avaliacao', require('./avaliacaoRoutes'));
router.use('/api/jogo', require('./jogoRoutes'));
router.use('/api/salas', require('./salaRoutes'));
router.use('/', require('./paginaRoutes'));

module.exports = router;
