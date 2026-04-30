import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { generateSecret, generateSync, verifySync, generateURI } from "otplib";

function getEncryptionKey(): Buffer {
  const hex = process.env.TOTP_ENCRYPTION_KEY ?? "";
  if (hex.length !== 64) {
    return Buffer.alloc(32, 0);
  }
  return Buffer.from(hex, "hex");
}

export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv  = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decryptSecret(ciphertext: string): string {
  const key = getEncryptionKey();
  const colonIdx = ciphertext.indexOf(":");
  const iv        = Buffer.from(ciphertext.slice(0, colonIdx), "hex");
  const encrypted = Buffer.from(ciphertext.slice(colonIdx + 1), "hex");
  const decipher  = createDecipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function generateTotpSecret(): string {
  return generateSecret();
}

export function getTotpAuthUrl(username: string, secret: string): string {
  const issuer = process.env.TOTP_ISSUER ?? "FinanzFlow";
  return generateURI({ label: username, secret, issuer });
}

export function verifyTotpToken(token: string, secret: string): boolean {
  try {
    const result = verifySync({ token, secret });
    return typeof result === "object" ? result.valid : result;
  } catch {
    return false;
  }
}

export { generateSync as generateTotpCode };

export function generateRecoveryCodePlaintext(): string {
  return randomBytes(10).toString("hex");
}
