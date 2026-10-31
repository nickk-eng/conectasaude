const path = require('path');

const pastaHtml = path.join(__dirname, '..', 'View', 'html');

// Devolve um controller que envia a página HTML indicada.
// As rotas aplicam a proteção antes de entregar páginas internas.
function pagina(arquivo) {
  return (_req, res) => res.sendFile(path.join(pastaHtml, arquivo));
}

module.exports = { pagina };
