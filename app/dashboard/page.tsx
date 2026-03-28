"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth, UserButton } from "@clerk/nextjs"
import { ALL_SERVICES, CATEGORIES } from "@/lib/services"
import type { Service } from "@/lib/services"

export default function DashboardPage() {
  const router = useRouter()
  const { isLoaded, isSignedIn } = useAuth()

  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      router.replace("/")
      return
    }
    fetch("/api/onboarding")
      .then((r) => r.json())
      .then((data) => {
        if (!data.completed) {
          router.replace("/onboarding")
          return
        }
        const ids = data.services as string[]
        const matched = ids
          .map((id) => ALL_SERVICES.find((s) => s.id === id))
          .filter((s): s is Service => !!s)
        setServices(matched)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [isLoaded, isSignedIn, router])

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <p className="text-white/40 text-sm">Loading your vault…</p>
      </div>
    )
  }

  // Group selected services by category, preserving category order
  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    selected: services.filter((s) => s.category === cat.name),
  })).filter((cat) => cat.selected.length > 0)

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="bg-black border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔐</span>
            <span className="text-lg font-bold text-white">Footprint</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/vault"
              className="text-sm text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              Full vault →
            </a>
            <UserButton />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Page title row */}
        <div className="flex items-start justify-between mb-10">
          <div>
            <h1 className="text-2xl font-bold text-white">Your accounts</h1>
            <p className="text-sm text-white/40 mt-1">
              Click a tile to open that entry in your vault.
            </p>
          </div>
          <a
            href="/onboarding"
            className="mt-1 text-sm text-white/50 hover:text-white/80 border border-white/20 hover:border-white/40 rounded-lg px-3 py-1.5 transition-all whitespace-nowrap"
          >
            Edit my services
          </a>
        </div>

        {grouped.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-white/30 mb-4">No services selected.</p>
            <a
              href="/onboarding"
              className="text-sm text-indigo-400 hover:text-indigo-300 font-medium"
            >
              ← Go back to setup
            </a>
          </div>
        ) : (
          <div className="space-y-10">
            {grouped.map((cat) => (
              <section key={cat.id}>
                {/* Category label */}
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest">
                    {cat.name}
                  </h2>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                {/* Tile grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {cat.selected.map((service) => (
                    <a
                      key={service.id}
                      href={`/vault?service=${service.id}`}
                      className="group bg-white/5 border border-white/20 rounded-xl p-5 flex flex-col items-center gap-3 hover:bg-white/10 hover:border-white/40 transition-all cursor-pointer"
                    >
                      <span className="text-4xl leading-none">{service.emoji}</span>
                      <span className="text-sm font-semibold text-white/80 text-center group-hover:text-white transition-colors">
                        {service.name}
                      </span>
                    </a>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
