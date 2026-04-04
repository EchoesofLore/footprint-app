"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth, UserButton } from "@clerk/nextjs"
import { ALL_SERVICES, CATEGORIES } from "@/lib/services"
import type { Service } from "@/lib/services"

const panel: React.CSSProperties = {
  background: "none",
  border: "none",
  boxShadow: "none",
}

const btn: React.CSSProperties = {
  fontFamily: "Inter, sans-serif",
  fontSize: "0.68rem",
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.70)",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.12)",
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
            color: "rgba(255,255,255,0.28)",
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
      className="vault-scene"
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
      <style>{`
        @keyframes vaultGlow {
          0%   { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }
        @keyframes ambientDrift {
          0%   { background-position: 65% 65%; }
          100% { background-position: 35% 35%; }
        }
        .vault-scene::before {
          content: '';
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background: linear-gradient(90deg, transparent 45%, rgba(255,255,255,0.025) 50%, transparent 55%);
          background-size: 600% 100%;
          animation: vaultGlow 18s linear infinite;
        }
      `}</style>

      {/* ── Page scrim ──────────────────────────────────────────── */}
      <div style={{ position: "fixed", inset: 0, background: "rgba(4,3,2,0.62)", pointerEvents: "none", zIndex: 0 }} />

      {/* ── Top ceiling light bar ────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "320px",
          pointerEvents: "none",
          zIndex: 0,
          background: "radial-gradient(ellipse 70% 180px at 50% 0%, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.025) 40%, transparent 100%)",
        }}
      />

      {/* ── Center ambient wall glow ─────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          top: "8%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 0,
          background: "radial-gradient(ellipse 100% 100% at 50% 0%, rgba(255,255,255,0.04) 0%, transparent 70%)",
        }}
      />

      {/* ── Floor reflected glow ─────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: "260px",
          pointerEvents: "none",
          zIndex: 0,
          background: "radial-gradient(ellipse 60% 160px at 50% 100%, rgba(255,255,255,0.04) 0%, transparent 100%)",
        }}
      />

      {/* ── Ambient drift glow ──────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background: "radial-gradient(ellipse 40% 40% at 50% 50%, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.03) 50%, transparent 70%)",
          backgroundSize: "200% 200%",
          backgroundPosition: "65% 65%",
          animation: "ambientDrift 12s ease-in-out infinite alternate",
        }}
      />

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
                color: "rgba(255,255,255,0.88)",
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
          maxWidth: "1160px",
          margin: "0 auto",
          padding: "2rem 1.75rem 4rem",
          background: "none",
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
                color: "rgba(255,255,255,0.28)",
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
                color: "rgba(255,255,255,0.88)",
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
                color: "rgba(255,255,255,0.32)",
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
                    color: "rgba(255,255,255,0.32)",
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
                    <div style={{ display: "flex", flexDirection: "column", gap: "64px" }}>
                      {grouped.map((cat) => (
                        <div
                          key={cat.id}
                          style={{
                            position: "relative",
                            overflow: "hidden",
                            background: "linear-gradient(180deg, rgba(32,32,32,0.78) 0%, rgba(16,16,16,0.92) 60%, rgba(10,10,10,0.96) 100%), url(/texture-panel.png) center/cover",
                            border: "1px solid rgba(255,255,255,0.05)",
                            borderLeft: "2px solid rgba(255,255,255,0.08)",
                            borderTop: "1px solid rgba(255,255,255,0.04)",
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 2px 10px rgba(0,0,0,0.40), 0 8px 30px rgba(0,0,0,0.60), 0 18px 60px rgba(0,0,0,0.70)",
                            borderRadius: 4,
                          }}
                        >
                          {/* Category header — label plate */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "10px 18px 9px",
                              borderBottom: "1px solid rgba(255,255,255,0.08)",
                              background: "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.005) 100%)",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03)",
                            }}
                          >
                            <div style={{ width: 2, height: 10, flexShrink: 0, background: "rgba(255,255,255,0.22)", boxShadow: "0 0 3px rgba(255,255,255,0.08)" }} />
                            <span
                              style={{
                                fontFamily: "Inter, sans-serif",
                                fontSize: 10,
                                fontWeight: 400,
                                letterSpacing: "0.2em",
                                color: "rgba(255,255,255,0.30)",
                                textTransform: "uppercase",
                              }}
                            >
                              ▪ {catLabels[cat.id] ?? cat.name}
                            </span>
                          </div>

                          {/* Service rows */}
                          <div style={{ display: "flex", flexDirection: "column", padding: "10px 10px 4px", background: "rgba(0,0,0,0.30)" }}>
                            {cat.selected.map((service, svcIdx) => (
                              <a
                                key={service.id}
                                href={`/vault?service=${service.id}`}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  minHeight: "50px",
                                  padding: "11px 18px",
                                  background: "rgba(11,11,12,0.96)",
                                  border: "1px solid rgba(255,255,255,0.04)",
                                  borderTop: "1px solid rgba(255,255,255,0.09)",
                                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 3px 8px rgba(0,0,0,0.90), inset 0 -2px 12px rgba(0,0,0,0.95)",
                                  marginBottom: svcIdx < cat.selected.length - 1 ? "4px" : "0",
                                  textDecoration: "none",
                                  cursor: "pointer",
                                  transition: "box-shadow 0.14s ease-out, border-color 0.14s ease-out, background 0.14s ease-out, transform 0.14s ease-out",
                                  borderRadius: 2,
                                }}
                                onMouseEnter={(e) => {
                                  const el = e.currentTarget as HTMLAnchorElement
                                  el.style.background = "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 8px), rgba(18,18,20,0.96)"
                                  el.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 1px 3px rgba(0,0,0,0.45), inset 0 -1px 5px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.70)"
                                  el.style.borderTopColor = "rgba(255,255,255,0.22)"
                                  el.style.transform = "translateY(-1px)"
                                }}
                                onMouseLeave={(e) => {
                                  const el = e.currentTarget as HTMLAnchorElement
                                  el.style.background = "rgba(11,11,12,0.96)"
                                  el.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 3px 8px rgba(0,0,0,0.90), inset 0 -2px 12px rgba(0,0,0,0.95), 0 0px 0px transparent"
                                  el.style.borderTopColor = "rgba(255,255,255,0.09)"
                                  el.style.transform = "translateY(0)"
                                }}
                              >
                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                  <span
                                    style={{
                                      fontFamily: "Inter, sans-serif",
                                      fontSize: "15px",
                                      fontWeight: 500,
                                      color: "rgba(255,255,255,0.95)",
                                      letterSpacing: "0.01em",
                                    }}
                                  >
                                    {service.name}
                                  </span>
                                  <span style={{ display: "inline-flex", alignItems: "center", border: "1px solid rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.15)", fontSize: "9px", letterSpacing: "0.15em", padding: "2px 6px", marginTop: 2, borderRadius: 2 }}>SECURED</span>
                                </div>
                                <span style={{ color: "rgba(255,255,255,0.38)", fontSize: "20px", lineHeight: 1, transition: "transform 0.15s ease, color 0.15s ease" }}>›</span>
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
                      color: "rgba(255,255,255,0.32)",
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
                          color: "rgba(255,255,255,0.88)",
                          lineHeight: 1,
                        }}
                      >
                        {stat.value}
                      </div>
                      <div
                        style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: "0.58rem",
                          color: "rgba(255,255,255,0.28)",
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
                      color: "rgba(255,255,255,0.32)",
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
                          color: "rgba(255,255,255,0.88)",
                          letterSpacing: "0.01em",
                        }}
                      >
                        {item.value}
                      </div>
                      <div
                        style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: "0.58rem",
                          color: "rgba(255,255,255,0.28)",
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
