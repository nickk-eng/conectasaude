const crypto = require('crypto');
const { generateSecret, generateURI, verify } = require('otplib');
const QRCode = require('qrcode');
const { NOME_AUTENTICADOR } = require('../Config/constantes');

const UUID_V1_A_V5 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function idDesafioValido(id) {
  return UUID_V1_A_V5.test(String(id || ''));
}

function chaveMfa() {
  const chave = Buffer.from(String(process.env.MFA_ENCRYPTION_KEY || ''), 'base64');
  if (chave.length !== 32) {
    throw new Error('MFA_ENCRYPTION_KEY deve conter uma chave Base64 de 32 bytes.');
  }
  return chave;
}

function cifrarSegredo(segredo) {
  const iv = crypto.randomBytes(12);
  const cifra = crypto.createCipheriv('aes-256-gcm', chaveMfa(), iv);
  const conteudo = Buffer.concat([cifra.update(segredo, 'utf8'), cifra.final()]);
  return [iv.toString('base64'), cifra.getAuthTag().toString('base64'), conteudo.toString('base64')].join('.');
}

function decifrarSegredo(valor) {
  const [ivCodificado, tagCodificada, conteudoCodificado] = String(valor || '').split('.');
  if (!ivCodificado || !tagCodificada || !conteudoCodificado) throw new Error('Segredo TOTP inválido.');
  const decifra = crypto.createDecipheriv('aes-256-gcm', chaveMfa(), Buffer.from(ivCodificado, 'base64'));
  decifra.setAuthTag(Buffer.from(tagCodificada, 'base64'));
  return Buffer.concat([decifra.update(Buffer.from(conteudoCodificado, 'base64')), decifra.final()]).toString('utf8');
}

function novoSegredoCifrado() {
  return cifrarSegredo(generateSecret());
}

async function verificarCodigo(codigo, segredo) {
  const verificacao = await verify({ token: codigo, secret: segredo, epochTolerance: 30 });
  return verificacao.valid;
}

async function montarRespostaDesafio(usuario, desafio) {
  const resposta = {
    mfaRequerida: true,
    desafioId: desafio.id,
    configuracaoMfa: desafio.tipo === 'configuracao'
  };

  if (desafio.tipo === 'configuracao') {
    const segredo = decifrarSegredo(desafio.segredo_temporario);
    const uri = generateURI({ secret: segredo, issuer: NOME_AUTENTICADOR, label: usuario.email });
    resposta.qrCode = await QRCode.toDataURL(uri, { width: 220, margin: 1 });
    resposta.chaveManual = segredo;
    resposta.mensagem = 'Escaneie o QR Code no seu aplicativo autenticador e informe o código gerado.';
  } else {
    resposta.mensagem = 'Abra seu aplicativo autenticador e informe o código de 6 dígitos.';
  }

  return resposta;
}

module.exports = {
  idDesafioValido,
  decifrarSegredo,
  novoSegredoCifrado,
  verificarCodigo,
  montarRespostaDesafio
};
