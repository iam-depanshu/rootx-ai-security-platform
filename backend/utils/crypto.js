const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * Encrypt a string using AES-256-CBC.
 * Uses ROOTX_ENCRYPTION_KEY from environment (must be 64 hex chars = 32 bytes).
 */
function encrypt(text) {
  const key = process.env.ROOTX_ENCRYPTION_KEY;
  if (!key) {
    console.warn('[ROOTX] ROOTX_ENCRYPTION_KEY not set — storing unencrypted');
    return text;
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt an AES-256-CBC encrypted string.
 */
function decrypt(text) {
  const key = process.env.ROOTX_ENCRYPTION_KEY;
  if (!key || !text.includes(':')) return text;
  const [ivHex, encryptedHex] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key, 'hex'), iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = { encrypt, decrypt };
