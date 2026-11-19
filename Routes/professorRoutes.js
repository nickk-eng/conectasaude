const router = require("express").Router();
const professor = require("../Controller/professorController");
const turma = require("../Controller/turmaController");
const { autenticar, permitir } = require("../Middleware/autenticacao");

router.get("/turmas", autenticar, permitir("professor"), turma.listar);
router.post("/turmas", autenticar, permitir("professor"), turma.criar);
router.get(
  "/turmas/:turmaId/alunos",
  autenticar,
  permitir("professor"),
  turma.pesquisar,
);
router.put(
  "/turmas/:turmaId/alunos/:id",
  autenticar,
  permitir("professor"),
  turma.alterar,
);
router.delete(
  "/turmas/:turmaId/alunos/:id",
  autenticar,
  permitir("professor"),
  turma.alterar,
);
router.all(
  "/turma/alunos{/:id}",
  autenticar,
  permitir("professor"),
  turma.rotaAntiga,
);

router.get(
  "/alunos",
  autenticar,
  permitir("professor", "admin"),
  professor.listarAlunos,
);
router.post(
  "/alunos/:id/revelar-email",
  autenticar,
  permitir("professor"),
  professor.revelarEmailAluno,
);
router.put(
  "/alunos/:id/responsaveis",
  autenticar,
  permitir("professor", "admin"),
  professor.atualizarResponsaveisAluno,
);
router.get(
  "/avaliacoes",
  autenticar,
  permitir("professor", "admin"),
  professor.listarAvaliacoes,
);
router.get(
  "/indicadores-ists",
  autenticar,
  permitir("professor", "admin"),
  professor.indicadoresIsts,
);
router.get(
  "/relatorios",
  autenticar,
  permitir("professor"),
  professor.relatorios,
);
router.post(
  "/perguntas",
  autenticar,
  permitir("professor"),
  professor.criarPergunta,
);

module.exports = router;
