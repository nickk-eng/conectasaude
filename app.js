const express = require('express');
const path = require('path');
const rotas = require('./Routes');
const { tratarErros } = require('./Middleware/erros');

const app = express();
const view = path.join(__dirname, 'View');

app.use(express.json());
app.use('/css', express.static(path.join(view, 'css')));
app.use('/js', express.static(path.join(view, 'js')));
app.use('/img', express.static(path.join(__dirname, 'img')));

app.use(rotas);
app.use(tratarErros);

module.exports = app;
