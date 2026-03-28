// lib/vaultLocal.ts
export type EncryptedBlob = { iv: number[]; content: number[] }

const KEY = "footprint_vault"

export function saveEncryptedVault(blob: EncryptedBlob) {
  localStorage.setItem(KEY, JSON.stringify(blob))
}

export function loadEncryptedVault(): EncryptedBlob | null {
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  return JSON.parse(raw) as EncryptedBlob
}
