const nodemailer = require('nodemailer');

let transporte;
function obterTransporte() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    const erro = new Error('Configure SMTP_HOST, SMTP_USER e SMTP_PASS no .env.');
    erro.code = 'SMTP_CONFIG_AUSENTE';
    throw erro;
  }
  if (!transporte) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000
    });
  }
  return transporte;
}

async function enviarCodigo(email, codigo) {
  const resultado = await obterTransporte().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'ConectaSaúde — Código para recuperar sua senha',
    text: `Seu código de recuperação do ConectaSaúde é: ${codigo}\n\nEle é válido por 10 minutos e só pode ser utilizado uma vez. Se você não solicitou a recuperação, ignore este e-mail. Não compartilhe este código.`
  });
  if (!resultado.accepted?.length) {
    const erro = new Error('O servidor de e-mail recusou o destinatário.');
    erro.code = 'SMTP_DESTINATARIO_RECUSADO';
    throw erro;
  }
}

module.exports = { enviarCodigo, obterTransporte };
