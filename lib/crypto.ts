// lib/crypto.ts

const enc = new TextEncoder()
const dec = new TextDecoder()

export async function deriveKey(password: string, userId: string) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  )

  // Salt MUST be unique per user. We use the Clerk userId for this.
  // This ensures two users with the same master password produce different keys,
  // and prevents precomputed (rainbow table) attacks on stolen vault data.
  const salt = enc.encode(userId)

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100_000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  )
}

export async function encryptData(key: CryptoKey, data: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(JSON.stringify(data))
  )

  return {
    iv: Array.from(iv),
    content: Array.from(new Uint8Array(encryptedBuffer)),
  }
}

export async function decryptData(
  key: CryptoKey,
  encrypted: { iv: number[]; content: number[] }
) {
  const iv = new Uint8Array(encrypted.iv)
  const content = new Uint8Array(encrypted.content)

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    content
  )

  return JSON.parse(dec.decode(decryptedBuffer))
}