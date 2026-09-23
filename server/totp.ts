import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { authenticator } from "otplib";

function getEncryptionKey(): Buffer {
  const hex = process.env.TOTP_ENCRYPTION_KEY ?? "";
  if (hex.length !== 64) {
    throw new Error(
      "TOTP_ENCRYPTION_KEY fehlt oder ist ungültig. Erzeugen: openssl rand -hex 32"
    );
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
  return authenticator.generateSecret();
}

export function getTotpAuthUrl(username: string, secret: string): string {
  const issuer = process.env.TOTP_ISSUER ?? "FinanzFlow";
  return authenticator.keyuri(username, issuer, secret);
}

export function verifyTotpToken(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

export function generateTotpCode(secret: string): string {
  return authenticator.generate(secret);
}

export function generateRecoveryCodePlaintext(): string {
  return randomBytes(10).toString("hex");
}
