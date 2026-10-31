const express = require('express');
const path = require('path');
const rotas = require('./Routes');
const { tratarErros } = require('./Middleware/erros');

const app = express();
const view = path.join(__dirname, 'View');
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' });
  next();
});

app.use(express.json({ limit: '32kb' }));
app.use('/css', express.static(path.join(view, 'css')));
app.use('/js', express.static(path.join(view, 'js')));
app.use('/img', express.static(path.join(__dirname, 'img')));

app.use(rotas);
app.use(tratarErros);

module.exports = app;
