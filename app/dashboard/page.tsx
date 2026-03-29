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
  const [activeCards, setActiveCards] = useState<Record<string, string>>({})

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
        // Default the first card in each category to active
        const defaults: Record<string, string> = {}
        CATEGORIES.forEach((cat) => {
          const first = matched.find((s) => s.category === cat.name)
          if (first) defaults[cat.id] = first.id
        })
        setActiveCards(defaults)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [isLoaded, isSignedIn, router])

  if (!isLoaded || loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
        }}
      >
        <p
          className="font-cinzel"
          style={{
            color: "rgba(200,146,42,0.4)",
            fontSize: "0.65rem",
            letterSpacing: "0.28em",
          }}
        >
          Opening the Vault…
        </p>
      </div>
    )
  }

  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    selected: services.filter((s) => s.category === cat.name),
  })).filter((cat) => cat.selected.length > 0)

  return (
    <div
      style={{
        minHeight: "100vh",
        position: "relative",
        backgroundImage: "url(/bg-dashboard.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Full-page dark overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      {/* ── Sticky nav ──────────────────────────────────────────── */}
      <header className="nav-stone" style={{ position: "sticky", top: 0, zIndex: 10 }}>
        <div
          style={{
            maxWidth: "1120px",
            margin: "0 auto",
            padding: "1rem 1.75rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Footprint"
              style={{
                height: "36px",
                width: "auto",
                filter: "drop-shadow(0 0 8px rgba(200,146,42,0.6))",
              }}
            />
            <span
              className="font-cinzel"
              style={{
                fontWeight: 900,
                fontSize: "0.95rem",
                letterSpacing: "0.2em",
                color: "var(--accent)",
              }}
            >
              Footprint
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1.75rem" }}>
            <a
              href="/vault"
              className="font-cinzel"
              style={{
                fontSize: "0.62rem",
                letterSpacing: "0.14em",
                color: "var(--accent)",
                textTransform: "uppercase",
                textDecoration: "none",
                opacity: 0.7,
                transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.opacity = "1")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.opacity = "0.7")
              }
            >
              Full Vault →
            </a>
            <UserButton />
          </div>
        </div>
      </header>

      {/* ── Hero banner ─────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "220px",
          borderBottom: "1px solid rgba(200,146,42,0.12)",
        }}
      >
        {/* Banner content */}
        <div
          style={{
            height: "100%",
            maxWidth: "1120px",
            margin: "0 auto",
            padding: "0 1.75rem",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <p
            className="font-cinzel"
            style={{
              fontSize: "0.6rem",
              letterSpacing: "0.28em",
              color: "rgba(200,146,42,0.45)",
              marginBottom: "0.5rem",
              textTransform: "uppercase",
            }}
          >
            Dashboard
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <h1
              className="font-cinzel"
              style={{
                fontSize: "clamp(1.6rem, 4vw, 2.6rem)",
                fontWeight: 900,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--text-primary)",
                lineHeight: 1,
              }}
            >
              Your Accounts
            </h1>
            <a
              href="/onboarding"
              className="btn-iron"
              style={{ fontSize: "0.6rem", padding: "0.5rem 1rem" }}
            >
              Edit Services
            </a>
          </div>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────── */}
      <main
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "1120px",
          margin: "0 auto",
          padding: "3rem 1.75rem",
        }}
      >
        {/* Stats row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "1.75rem",
            marginBottom: "3.75rem",
          }}
        >
          {[
            { label: "Services", value: services.length },
            { label: "Categories", value: grouped.length },
            { label: "Encryption", value: "AES-256" },
          ].map((stat) => (
            <div key={stat.label} className="stat-card">
              <div
                className="font-cinzel"
                style={{
                  fontSize: "1.6rem",
                  fontWeight: 700,
                  color: "var(--accent)",
                  letterSpacing: "0.04em",
                  lineHeight: 1,
                }}
              >
                {stat.value}
              </div>
              <div
                style={{
                  fontSize: "0.65rem",
                  color: "var(--text-secondary)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginTop: "0.4rem",
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Categories */}
        {grouped.length === 0 ? (
          <div style={{ textAlign: "center", padding: "6rem 0" }}>
            <p
              style={{
                color: "var(--text-muted)",
                marginBottom: "1.5rem",
                fontSize: "0.9rem",
              }}
            >
              No services selected yet.
            </p>
            <a href="/onboarding" className="btn-iron">
              ← Go to Setup
            </a>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "3.25rem" }}>
            {grouped.map((cat, catIdx) => {
              const catNum = String(catIdx + 1).padStart(2, "0")
              const catActiveId = activeCards[cat.id] ?? ""

              return (
                <section key={cat.id}>
                  {/* Category header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.875rem",
                      marginBottom: "1.25rem",
                    }}
                  >
                    <span className="cat-number">{catNum}</span>
                    <span
                      className="font-cinzel"
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        letterSpacing: "0.18em",
                        color: "var(--text-secondary)",
                        textTransform: "uppercase",
                      }}
                    >
                      {cat.name}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: "1px",
                        background: "rgba(200,146,42,0.1)",
                      }}
                    />
                  </div>

                  {/* Cards */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))",
                      gap: "1rem",
                      overflow: "visible",
                    }}
                  >
                    {cat.selected.map((service) => {
                      const isActive = catActiveId === service.id
                      const isDimmed = !!catActiveId && !isActive
                      return (
                        <div
                          key={service.id}
                          onClick={() =>
                            setActiveCards((prev) => ({
                              ...prev,
                              [cat.id]: isActive ? "" : service.id,
                            }))
                          }
                          className="card-stone"
                          style={{
                            padding: "1.5rem 1.25rem",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "0.75rem",
                            cursor: "pointer",
                            position: "relative",
                            zIndex: isActive ? 2 : 1,
                            boxShadow: isActive
                              ? "0 0 36px rgba(200,146,42,0.35), 0 8px 40px rgba(0,0,0,0.55)"
                              : "none",
                            borderColor: isActive ? "var(--accent)" : undefined,
                            transition: "box-shadow 0.35s ease, border-color 0.35s ease",
                          }}
                        >
                          <span
                            style={{
                              fontSize: isActive ? "2.4rem" : "1.85rem",
                              lineHeight: 1,
                              transition: "font-size 0.35s ease",
                            }}
                          >
                            {service.emoji}
                          </span>
                          <span
                            className="font-cinzel"
                            style={{
                              fontSize: isActive ? "0.7rem" : "0.64rem",
                              fontWeight: 700,
                              letterSpacing: "0.08em",
                              color: isActive ? "var(--accent)" : "var(--text-primary)",
                              textTransform: "uppercase",
                              textAlign: "center",
                              transition: "font-size 0.35s ease, color 0.35s ease",
                            }}
                          >
                            {service.name}
                          </span>
                          {isActive && (
                            <a
                              href={`/vault?service=${service.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="btn-iron"
                              style={{
                                fontSize: "0.55rem",
                                padding: "0.3rem 0.75rem",
                                marginTop: "0.25rem",
                              }}
                            >
                              Open →
                            </a>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
