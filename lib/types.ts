// lib/types.ts

export type VaultEntry = {
  id: string
  site: string
  username: string
  password: string
  notes?: string
  tags?: string[]
  category?: string
  deletedAt?: number
  favorite?: boolean
  createdAt?: number
  updatedAt?: number
  domain?: string
}

export type VaultData = {
  version: number
  entries: VaultEntry[]
}