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
          className="font-orbitron"
          style={{
            color: "rgba(0,212,255,0.3)",
            fontSize: "0.62rem",
            letterSpacing: "0.32em",
          }}
        >
          INITIALIZING VAULT…
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
      className="cyber-grid"
      style={{ minHeight: "100vh", background: "var(--bg)" }}
    >
      {/* ── Sticky nav ──────────────────────────────────────────── */}
      <header className="nav-cyber" style={{ position: "sticky", top: 0, zIndex: 10 }}>
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
                filter: "drop-shadow(0 0 8px rgba(0,212,255,0.65))",
              }}
            />
            <span
              className="font-orbitron"
              style={{
                fontWeight: 900,
                fontSize: "0.95rem",
                letterSpacing: "0.26em",
                color: "var(--accent)",
              }}
            >
              FOOTPRINT
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1.75rem" }}>
            <a
              href="/vault"
              className="font-orbitron"
              style={{
                fontSize: "0.58rem",
                letterSpacing: "0.18em",
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
          height: "220px",
          overflow: "hidden",
          borderBottom: "1px solid rgba(0,212,255,0.1)",
        }}
      >
        {/* Ken Burns background image */}
        <div
          className="hero-bg-img"
          style={{
            backgroundImage: "url(/logo.png)",
            backgroundPosition: "60% center",
            animationDuration: "30s",
          }}
        />
        {/* Gradient overlays */}
        <div className="hero-overlays" />
        {/* Glow pulse */}
        <div
          style={{
            position: "absolute",
            right: "10%",
            top: "50%",
            width: "380px",
            height: "380px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(0,212,255,0.1) 0%, transparent 65%)",
            transform: "translate(50%, -50%)",
            animation: "hero-glow-breathe 3s ease-in-out infinite",
            pointerEvents: "none",
            zIndex: 2,
          }}
        />
        {/* Banner content */}
        <div
          style={{
            position: "relative",
            zIndex: 3,
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
            className="font-orbitron"
            style={{
              fontSize: "0.58rem",
              letterSpacing: "0.34em",
              color: "rgba(0,212,255,0.38)",
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
              className="font-orbitron"
              style={{
                fontSize: "clamp(1.6rem, 4vw, 2.6rem)",
                fontWeight: 900,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                color: "var(--text-primary)",
                lineHeight: 1,
              }}
            >
              YOUR ACCOUNTS
            </h1>
            <a
              href="/onboarding"
              className="btn-cyber"
              style={{ fontSize: "0.58rem", padding: "0.5rem 1rem" }}
            >
              Edit Services
            </a>
          </div>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────── */}
      <main
        style={{
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
                className="font-orbitron"
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
                  fontSize: "0.62rem",
                  color: "var(--text-secondary)",
                  letterSpacing: "0.12em",
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
            <a href="/onboarding" className="btn-cyber">
              ← Go to Setup
            </a>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "3.25rem" }}>
            {grouped.map((cat, catIdx) => {
              const catNum = String(catIdx + 1).padStart(2, "0")
              const [featured, ...rest] = cat.selected

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
                      className="font-orbitron"
                      style={{
                        fontSize: "0.62rem",
                        fontWeight: 700,
                        letterSpacing: "0.22em",
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
                        background: "rgba(0,212,255,0.08)",
                      }}
                    />
                  </div>

                  {/* Cards */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(155px, 1fr))",
                      gap: "1rem",
                    }}
                  >
                    {/* Featured card */}
                    {featured && (
                      <a
                        href={`/vault?service=${featured.id}`}
                        className="card-cyber"
                        style={{
                          gridColumn:
                            cat.selected.length > 1 ? "span 2" : "span 1",
                          padding: "1.75rem",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          gap: "1rem",
                          textDecoration: "none",
                          borderRadius: "2px",
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ fontSize: "2.6rem", lineHeight: 1 }}>
                          {featured.emoji}
                        </span>
                        <div>
                          <div
                            className="font-orbitron"
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              letterSpacing: "0.12em",
                              color: "var(--text-primary)",
                              textTransform: "uppercase",
                            }}
                          >
                            {featured.name}
                          </div>
                          <div
                            style={{
                              fontSize: "0.6rem",
                              color: "var(--accent)",
                              opacity: 0.55,
                              marginTop: "0.3rem",
                              letterSpacing: "0.1em",
                            }}
                          >
                            OPEN VAULT →
                          </div>
                        </div>
                      </a>
                    )}

                    {/* Smaller cards */}
                    {rest.map((service) => (
                      <a
                        key={service.id}
                        href={`/vault?service=${service.id}`}
                        className="card-cyber"
                        style={{
                          padding: "1.25rem 1rem",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "0.75rem",
                          textDecoration: "none",
                          borderRadius: "2px",
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ fontSize: "1.8rem", lineHeight: 1 }}>
                          {service.emoji}
                        </span>
                        <span
                          className="font-orbitron"
                          style={{
                            fontSize: "0.58rem",
                            fontWeight: 700,
                            letterSpacing: "0.1em",
                            color: "var(--text-secondary)",
                            textTransform: "uppercase",
                            textAlign: "center",
                          }}
                        >
                          {service.name}
                        </span>
                      </a>
                    ))}
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
