const banco = require("../Config/banco");

async function resumo() {
  const dados = await banco.query(
    `SELECT
       (SELECT COUNT(*)::int FROM turmas) AS turmas,
       (SELECT COUNT(*)::int FROM escolas) AS escolas,
       (SELECT COUNT(*)::int FROM partidas) AS partidas`,
  );
  return dados.rows[0];
}

module.exports = { resumo };
