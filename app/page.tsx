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
        height: "100vh",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Particles />

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav
        className="nav-cyber"
        style={{
          flexShrink: 0,
          position: "relative",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 2.5rem",
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
              fontSize: "1rem",
              letterSpacing: "0.28em",
              color: "var(--accent)",
            }}
          >
            FOOTPRINT
          </span>
        </div>

        <a href="/sign-in" className="btn-cyber">
          Sign In
        </a>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section
        style={{
          flex: 1,
          position: "relative",
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        {/* Animated Ken Burns background image */}
        <div
          className="hero-bg-img"
          style={{ backgroundImage: "url(/logo.png)" }}
        />

        {/* Gradient overlays: left fade + global dim */}
        <div className="hero-overlays" />

        {/* Breathing cyan glow over the lock */}
        <div className="hero-glow-pulse" />

        {/* Left content */}
        <div
          style={{
            position: "relative",
            zIndex: 3,
            maxWidth: "600px",
            paddingLeft: "56px",
          }}
        >
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
      </section>
    </div>
  )
}
