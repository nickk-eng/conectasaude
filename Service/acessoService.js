function aguardaAprovacao(usuario) {
  return (
    usuario.perfil === "aluno" &&
    (usuario.solicitou_professor === true ||
      Boolean(
        usuario.status_professor &&
        usuario.status_professor !== "nao_aplicavel",
      ))
  );
}

function destinoUsuario(usuario) {
  if (aguardaAprovacao(usuario)) return "/aguardando-aprovacao";
  return usuario.perfil === "admin" ? "/admin" : "/home";
}

module.exports = { aguardaAprovacao, destinoUsuario };
