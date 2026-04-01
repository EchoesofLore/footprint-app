"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth, UserButton } from "@clerk/nextjs"
import { ALL_SERVICES, CATEGORIES } from "@/lib/services"
import type { Service } from "@/lib/services"

const panel: React.CSSProperties = {
  background: "none",
  border: "1px solid #3a3a3a",
  boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.08)",
}

const btn: React.CSSProperties = {
  fontFamily: "Inter, sans-serif",
  fontSize: "0.68rem",
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#e8e0d0",
  background: "#1a1a1a",
  border: "1px solid #333",
  padding: "0.45rem 1rem",
  textDecoration: "none",
  display: "inline-block",
  cursor: "pointer",
  transition: "filter 0.2s",
}

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
          background: "#0a0a0a",
        }}
      >
        <p
          style={{
            fontFamily: "Inter, sans-serif",
            color: "#444",
            fontSize: "0.65rem",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
          }}
        >
          Loading…
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
        backgroundColor: "#0a0a0a",
      }}
    >

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "rgba(10,10,10,0.72)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            maxWidth: "1400px",
            margin: "0 auto",
            padding: "0.875rem 1.75rem",
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
              style={{ height: "32px", width: "auto", opacity: 0.85 }}
            />
            <span
              style={{
                fontFamily: "Inter, sans-serif",
                fontWeight: 600,
                fontSize: "0.9rem",
                letterSpacing: "0.12em",
                color: "#e8e0d0",
                textTransform: "uppercase",
              }}
            >
              Footprint
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            <a
              href="/vault"
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "0.65rem",
                letterSpacing: "0.1em",
                color: "#666",
                textTransform: "uppercase",
                textDecoration: "none",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#a0a0a0")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#666")}
            >
              Full Vault →
            </a>
            <UserButton />
          </div>
        </div>
      </header>

      {/* ── Main ─────────────────────────────────────────────────── */}
      <main
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "2rem 1.75rem 4rem",
        }}
      >
        {/* Page title row */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: "1.75rem",
          }}
        >
          <div>
            <p
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "0.55rem",
                letterSpacing: "0.4em",
                color: "#444",
                textTransform: "uppercase",
                marginBottom: "0.4rem",
              }}
            >
              Dashboard
            </p>
            <h1
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "clamp(1.3rem, 3vw, 1.9rem)",
                fontWeight: 600,
                color: "#e8e0d0",
                letterSpacing: "-0.01em",
                lineHeight: 1,
              }}
            >
              Your Accounts
            </h1>
          </div>
          <a href="/onboarding" style={btn}>Edit Services</a>
        </div>

        {grouped.length === 0 ? (
          <div style={{ textAlign: "center", padding: "6rem 0" }}>
            <p
              style={{
                fontFamily: "Inter, sans-serif",
                color: "#555",
                marginBottom: "1.5rem",
                fontSize: "0.9rem",
              }}
            >
              No services selected yet.
            </p>
            <a href="/onboarding" style={btn}>← Go to Setup</a>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {/* ── Primary panel: accounts ──────────────────────── */}
            <section style={panel}>
              <div
                style={{
                  padding: "1rem 1.75rem",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <h2
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: "0.58rem",
                    fontWeight: 500,
                    letterSpacing: "0.22em",
                    color: "#555",
                    textTransform: "uppercase",
                  }}
                >
                  Accounts
                </h2>
              </div>

              <div style={{ padding: "1.5rem 1.75rem" }}>
                {(() => {
                  const catLabels: Record<string, string> = {
                    entertainment: "Entertainment Systems",
                    utilities: "Utility Systems",
                    finance: "Financial Records",
                    health: "Health Records",
                    other: "General Access",
                  }
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                      {grouped.map((cat) => (
                        <div
                          key={cat.id}
                          style={{
                            background: "rgba(255,255,255,0.02)",
                            border: "1px solid #222222",
                            boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.04)",
                          }}
                        >
                          {/* Category header */}
                          <div
                            style={{
                              padding: "10px 16px",
                              borderBottom: "1px solid #222222",
                              marginBottom: "1rem",
                            }}
                          >
                            <span
                              style={{
                                fontFamily: "Inter, sans-serif",
                                fontSize: "13px",
                                fontWeight: 500,
                                letterSpacing: "2.5px",
                                color: "#aaaaaa",
                                textTransform: "uppercase",
                              }}
                            >
                              {catLabels[cat.id] ?? cat.name}
                            </span>
                          </div>

                          {/* Service rows */}
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            {cat.selected.map((service, svcIdx) => (
                              <a
                                key={service.id}
                                href={`/vault?service=${service.id}`}
                                className="flex items-center justify-between min-h-[72px] py-5 px-5 border-b border-[#c8922a]/10 last:border-b-0 bg-[#111111] hover:bg-[#161616] hover:border-[#c8922a]/25 active:scale-[0.99] transition-all duration-200 cursor-pointer no-underline"
                              >
                                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                                  <span
                                    style={{
                                      fontFamily: "Inter, sans-serif",
                                      fontSize: "15px",
                                      fontWeight: 500,
                                      color: "#e8e0d0",
                                      letterSpacing: "0.01em",
                                    }}
                                  >
                                    {service.name}
                                  </span>
                                  <span className="inline-flex items-center border border-[#c8922a]/25 text-[#c8922a]/55 text-[9px] tracking-[0.15em] px-1.5 py-0.5 rounded-sm mt-1">SECURED</span>
                                </div>
                                <span className="text-[#c8922a]/50 text-xl leading-none">›</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </section>

            {/* ── Secondary panels ─────────────────────────────── */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1.25rem",
              }}
            >
              {/* Overview / stats */}
              <section style={panel}>
                <div
                  style={{
                    padding: "1rem 1.75rem",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <h2
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: "0.58rem",
                      fontWeight: 500,
                      letterSpacing: "0.22em",
                      color: "#555",
                      textTransform: "uppercase",
                    }}
                  >
                    Overview
                  </h2>
                </div>
                <div style={{ padding: "1.5rem 1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  {[
                    { label: "Services tracked", value: String(services.length) },
                    { label: "Categories", value: String(grouped.length) },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "1rem" }}
                    >
                      <div
                        style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: "1.75rem",
                          fontWeight: 300,
                          color: "#e8e0d0",
                          lineHeight: 1,
                        }}
                      >
                        {stat.value}
                      </div>
                      <div
                        style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: "0.58rem",
                          color: "#444",
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          marginTop: "0.35rem",
                        }}
                      >
                        {stat.label}
                      </div>
                    </div>
                  ))}
                  <div>
                    <a href="/onboarding" style={btn}>Manage services</a>
                  </div>
                </div>
              </section>

              {/* Security info */}
              <section style={panel}>
                <div
                  style={{
                    padding: "1rem 1.75rem",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <h2
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: "0.58rem",
                      fontWeight: 500,
                      letterSpacing: "0.22em",
                      color: "#555",
                      textTransform: "uppercase",
                    }}
                  >
                    Security
                  </h2>
                </div>
                <div style={{ padding: "1.5rem 1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  {[
                    { label: "Encryption", value: "AES-256-GCM" },
                    { label: "Key derivation", value: "PBKDF2 · 100K iterations" },
                    { label: "Architecture", value: "Zero knowledge" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "1rem" }}
                    >
                      <div
                        style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: "0.85rem",
                          fontWeight: 400,
                          color: "#e8e0d0",
                          letterSpacing: "0.01em",
                        }}
                      >
                        {item.value}
                      </div>
                      <div
                        style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: "0.58rem",
                          color: "#444",
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          marginTop: "0.3rem",
                        }}
                      >
                        {item.label}
                      </div>
                    </div>
                  ))}
                  <div>
                    <a href="/vault" style={btn}>Open vault →</a>
                  </div>
                </div>
              </section>
            </div>

          </div>
        )}
      </main>
    </div>
  )
}
