const crypto = require("node:crypto");

function mascararEmail(email) {
  if (email === null || email === undefined || String(email).trim() === "")
    return email;
  const valor = String(email);
  if (valor.includes("*******")) return valor;
  const separador = valor.lastIndexOf("@");
  if (separador < 1) return valor;
  const local = valor.slice(0, separador);
  const dominio = valor.slice(separador);
  return `${local.length <= 3 ? local.slice(0, 1) : local.slice(0, 3)}*******${dominio}`;
}

function gerarHashEmail(email) {
  const segredo = String(process.env.EMAIL_HASH_SECRET || "");
  if (segredo.length < 32)
    throw new Error("EMAIL_HASH_SECRET deve ter pelo menos 32 caracteres.");
  return crypto
    .createHmac("sha256", segredo)
    .update(String(email).trim().toLowerCase())
    .digest("hex");
}

function chaveEmail() {
  const chave = Buffer.from(
    String(process.env.EMAIL_ENCRYPTION_KEY || ""),
    "base64",
  );
  if (chave.length !== 32)
    throw new Error("EMAIL_ENCRYPTION_KEY deve ser uma chave Base64 de 32 bytes.");
  return chave;
}

function criptografarEmail(email) {
  const iv = crypto.randomBytes(12);
  const cifra = crypto.createCipheriv("aes-256-gcm", chaveEmail(), iv);
  const conteudo = Buffer.concat([
    cifra.update(String(email), "utf8"),
    cifra.final(),
  ]);
  return [
    iv.toString("base64"),
    cifra.getAuthTag().toString("base64"),
    conteudo.toString("base64"),
  ].join(".");
}

function descriptografarEmail(cipherText) {
  const [iv, tag, conteudo] = String(cipherText || "").split(".");
  if (!iv || !tag || !conteudo) throw new Error("E-mail cifrado inválido.");
  const decifra = crypto.createDecipheriv(
    "aes-256-gcm",
    chaveEmail(),
    Buffer.from(iv, "base64"),
  );
  decifra.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decifra.update(Buffer.from(conteudo, "base64")),
    decifra.final(),
  ]).toString("utf8");
}

module.exports = {
  mascararEmail,
  gerarHashEmail,
  criptografarEmail,
  descriptografarEmail,
};
