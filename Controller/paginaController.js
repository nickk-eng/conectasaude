const path = require('path');

const pastaHtml = path.join(__dirname, '..', 'View', 'html');

function pagina(arquivo) {
  return (_req, res) => res.sendFile(path.join(pastaHtml, arquivo));
}

module.exports = { pagina };
