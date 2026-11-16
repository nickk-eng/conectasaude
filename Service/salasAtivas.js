const { criarServicoSalas } = require("./salaService");
const perguntasModel = require("../Model/perguntaModel");
const { salvarResultados } = require("../Model/salaModel");

module.exports = criarServicoSalas({ perguntasModel, salvarResultados });
