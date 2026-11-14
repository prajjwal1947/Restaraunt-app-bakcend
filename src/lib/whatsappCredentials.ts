import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { HttpError } from "./http";

const getEncryptionKey = (): Buffer => {
  const secret = process.env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new HttpError(
      503,
      "WHATSAPP_ENCRYPTION_NOT_CONFIGURED",
      "WhatsApp credential encryption is not configured."
    );
  }
  return createHash("sha256").update(secret).digest();
};

export const encryptWhatsAppToken = (token: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64")).join(".");
};

export const decryptWhatsAppToken = (encryptedToken: string): string => {
  try {
    const [encodedIv, encodedTag, encodedCiphertext] = encryptedToken.split(".");
    if (!encodedIv || !encodedTag || !encodedCiphertext) throw new Error("Invalid encrypted token");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
      Buffer.from(encodedIv, "base64")
    );
    decipher.setAuthTag(Buffer.from(encodedTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new HttpError(
      503,
      "WHATSAPP_CREDENTIAL_DECRYPTION_FAILED",
      "WhatsApp credentials could not be decrypted. Check the server encryption key."
    );
  }
};