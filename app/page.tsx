import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { supabaseServer } from "@/lib/supabaseServer"
import Particles from "@/app/components/Particles"

export default async function Home() {
  const { userId } = await auth()

  if (userId) {
    const { data } = await supabaseServer
      .from("user_onboarding")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle()

    redirect(data ? "/dashboard" : "/onboarding")
  }

  return (
    <div
      style={{
        background: "var(--bg)",
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Particles />

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav
        className="nav-cyber"
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1.25rem 2.5rem",
        }}
      >
        <span
          className="font-orbitron"
          style={{
            fontWeight: 900,
            fontSize: "1rem",
            letterSpacing: "0.28em",
            color: "var(--accent)",
          }}
        >
          FOOTPRINT
        </span>

        <a href="/sign-in" className="btn-cyber">
          Sign In
        </a>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          minHeight: "calc(100vh - 76px)",
          padding: "4rem 2.5rem",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "5rem",
          }}
        >
          {/* Left content */}
          <div style={{ flex: "1 1 0", minWidth: 0 }}>
            <p
              className="font-orbitron"
              style={{
                fontSize: "0.62rem",
                letterSpacing: "0.38em",
                color: "rgba(0,212,255,0.45)",
                marginBottom: "1.5rem",
                textTransform: "uppercase",
              }}
            >
              Encrypted Password Manager
            </p>

            <h1
              className="font-orbitron"
              style={{
                fontSize: "clamp(2.6rem, 6vw, 5.25rem)",
                fontWeight: 900,
                lineHeight: 1.04,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                color: "var(--text-primary)",
                marginBottom: "1.5rem",
              }}
            >
              EVERY ACCOUNT.
              <br />
              <span style={{ color: "var(--accent)" }}>SECURED.</span>
            </h1>

            <p
              style={{
                fontSize: "1.05rem",
                color: "var(--text-secondary)",
                lineHeight: 1.8,
                maxWidth: "430px",
                marginBottom: "2.75rem",
              }}
            >
              End-to-end encrypted. Zero knowledge architecture.
              Your master password never leaves your device.
            </p>

            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <a
                href="/sign-in"
                className="btn-cyber-solid"
                style={{ padding: "0.8rem 2.25rem" }}
              >
                Get Started
              </a>
              <a
                href="/sign-in"
                className="btn-cyber"
                style={{ padding: "0.8rem 2.25rem" }}
              >
                Sign In →
              </a>
            </div>

            {/* Tech pills */}
            <div
              style={{
                display: "flex",
                gap: "2rem",
                marginTop: "3.25rem",
                flexWrap: "wrap",
              }}
            >
              {["AES-256-GCM", "PBKDF2 100K", "Zero Knowledge"].map((tag) => (
                <span
                  key={tag}
                  className="font-orbitron"
                  style={{
                    fontSize: "0.57rem",
                    letterSpacing: "0.14em",
                    color: "rgba(0,212,255,0.42)",
                    borderBottom: "1px solid rgba(0,212,255,0.18)",
                    paddingBottom: "0.3rem",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Right — logo */}
          <div
            style={{
              flex: "0 0 360px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            className="hidden lg:flex"
          >
            <div
              style={{ position: "relative", width: "320px", height: "320px" }}
            >
              {/* Decorative rings */}
              <div
                className="pulse-ring"
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  border: "1px solid rgba(0,212,255,0.18)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: "28px",
                  borderRadius: "50%",
                  border: "1px solid rgba(0,212,255,0.09)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: "56px",
                  borderRadius: "50%",
                  border: "1px solid rgba(0,212,255,0.05)",
                }}
              />
              {/* Logo image */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.png"
                  alt="Footprint"
                  style={{
                    width: "200px",
                    height: "200px",
                    objectFit: "contain",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
