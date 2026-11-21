const router = require("express").Router();
const admin = require("../Controller/adminController");
const { autenticar, permitir } = require("../Middleware/autenticacao");

router.use(autenticar, permitir("admin"));

router.get("/perguntas", admin.listarPerguntas);
router.get("/resumo", admin.resumo);
router.post("/perguntas", admin.criarPergunta);
router.put("/perguntas/:id", admin.atualizarPergunta);
router.delete("/perguntas/:id", admin.excluirPergunta);
router.patch("/perguntas/:id", admin.avaliarPergunta);
router.get("/usuarios", admin.listarUsuarios);
router.post("/usuarios/:id/revelar-email", admin.revelarEmailUsuario);
router.patch("/usuarios/:id", admin.atualizarUsuario);
router.patch("/usuarios/:id/professor", admin.decidirProfessor);
router.get("/solicitacoes-privacidade", admin.listarSolicitacoesPrivacidade);
router.patch(
  "/solicitacoes-privacidade/:id",
  require("../Controller/privacidadeController").responderSolicitacao,
);
router.get("/auditoria", admin.listarAuditoria);

module.exports = router;
