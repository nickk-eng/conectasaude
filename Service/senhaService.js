const bcrypt = require('bcryptjs');

function gerarHash(senha) {
  return bcrypt.hash(senha, 12);
}

function conferir(senha, hashSalvo) {
  return bcrypt.compare(senha, hashSalvo);
}

function senhaForte(senha) {
  return typeof senha === 'string'
    && senha.length >= 8
    && /[A-Z]/.test(senha)
    && /[0-9]/.test(senha)
    && /[^A-Za-z0-9]/.test(senha);
}

module.exports = { gerarHash, conferir, senhaForte };
