// lib/services.ts
// Shared service/category definitions used by onboarding and dashboard.

export type Service = {
  id: string
  name: string
  emoji: string
  category: string
}

export type Category = {
  id: string
  name: string
  description: string
  services: Service[]
}

export const CATEGORIES: Category[] = [
  {
    id: "entertainment",
    name: "Entertainment",
    description: "Streaming and media subscriptions",
    services: [
      { id: "netflix", name: "Netflix", emoji: "🎬", category: "Entertainment" },
      { id: "hulu", name: "Hulu", emoji: "📺", category: "Entertainment" },
      { id: "disney-plus", name: "Disney+", emoji: "🏰", category: "Entertainment" },
      { id: "amazon-prime", name: "Amazon Prime", emoji: "📦", category: "Entertainment" },
      { id: "spotify", name: "Spotify", emoji: "🎵", category: "Entertainment" },
      { id: "youtube-premium", name: "YouTube Premium", emoji: "▶️", category: "Entertainment" },
    ],
  },
  {
    id: "utilities",
    name: "Utilities",
    description: "Home and infrastructure services",
    services: [
      { id: "electric", name: "Electric", emoji: "⚡", category: "Utilities" },
      { id: "gas", name: "Gas", emoji: "🔥", category: "Utilities" },
      { id: "water", name: "Water", emoji: "💧", category: "Utilities" },
      { id: "internet", name: "Internet", emoji: "🌐", category: "Utilities" },
      { id: "phone", name: "Phone", emoji: "📱", category: "Utilities" },
    ],
  },
  {
    id: "finance",
    name: "Finance",
    description: "Banking and financial accounts",
    services: [
      { id: "bank-account", name: "Bank Account", emoji: "🏦", category: "Finance" },
      { id: "credit-card", name: "Credit Card", emoji: "💳", category: "Finance" },
      { id: "mortgage", name: "Mortgage", emoji: "🏠", category: "Finance" },
      { id: "investment-account", name: "Investment Account", emoji: "📈", category: "Finance" },
    ],
  },
  {
    id: "health",
    name: "Health",
    description: "Healthcare providers and services",
    services: [
      { id: "doctor", name: "Doctor", emoji: "👨‍⚕️", category: "Health" },
      { id: "dentist", name: "Dentist", emoji: "🦷", category: "Health" },
      { id: "insurance", name: "Insurance", emoji: "🏥", category: "Health" },
      { id: "pharmacy", name: "Pharmacy", emoji: "💊", category: "Health" },
    ],
  },
  {
    id: "other",
    name: "Other",
    description: "Email, work, and government accounts",
    services: [
      { id: "email", name: "Email", emoji: "📧", category: "Other" },
      { id: "work-account", name: "Work Account", emoji: "💼", category: "Other" },
      { id: "government-tax", name: "Government/Tax", emoji: "🏛️", category: "Other" },
    ],
  },
]

export const ALL_SERVICES: Service[] = CATEGORIES.flatMap((c) => c.services)

export function getServiceById(id: string): Service | undefined {
  return ALL_SERVICES.find((s) => s.id === id)
}
