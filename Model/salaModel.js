const banco = require('../Config/banco');

async function salvarResultados(sala) {
  const cliente = await banco.connect();
  try {
    await cliente.query('BEGIN');
    for (const jogador of sala.jogadores) {
      await cliente.query(
        `INSERT INTO partidas (usuario_id, acertos, erros, nivel, modo, resultado)
         VALUES ($1, $2, $3, $4, 'sala', $5)`,
        [jogador.id, jogador.acertos, jogador.erros, sala.nivel, sala.resultado]
      );
      await cliente.query(
        `INSERT INTO auditoria_acessos (usuario_id, perfil, acao, recurso, detalhes, metodo, rota)
         VALUES ($1, 'aluno', 'jogo_finalizado', 'jogo', $2, 'POST', '/api/salas')`,
        [jogador.id, JSON.stringify({ acertos: jogador.acertos, erros: jogador.erros,
          nivel: sala.nivel, modo: 'sala', categoriaIst: sala.categoriaIst, resultado: sala.resultado, codigoSala: sala.codigo })]
      );
    }
    await cliente.query('COMMIT');
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}

module.exports = { salvarResultados };
