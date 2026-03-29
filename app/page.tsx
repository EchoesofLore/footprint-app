import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { supabaseServer } from "@/lib/supabaseServer"

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
      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav
        className="nav-stone"
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
              filter: "drop-shadow(0 0 8px rgba(200,146,42,0.65))",
            }}
          />
          <span
            className="font-cinzel"
            style={{
              fontWeight: 900,
              fontSize: "1rem",
              letterSpacing: "0.22em",
              color: "var(--accent)",
            }}
          >
            Footprint
          </span>
        </div>

        <a href="/sign-in" className="btn-iron">
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
        {/* Ken Burns background image */}
        <div
          className="hero-bg-img"
          style={{ backgroundImage: "url(/hero-vault.png)" }}
        />

        {/* Gradient overlays */}
        <div className="hero-overlays" />

        {/* Amber glow */}
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
            className="font-cinzel"
            style={{
              fontSize: "0.65rem",
              letterSpacing: "0.3em",
              color: "rgba(200,146,42,0.55)",
              marginBottom: "1.5rem",
              textTransform: "uppercase",
            }}
          >
            Encrypted Password Manager
          </p>

          <h1
            className="font-cinzel"
            style={{
              fontSize: "clamp(2.6rem, 6vw, 5.25rem)",
              fontWeight: 900,
              lineHeight: 1.08,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--text-primary)",
              marginBottom: "1.5rem",
            }}
          >
            Every Account.
            <br />
            <span style={{ color: "var(--accent)" }}>Secured.</span>
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
              className="btn-iron-solid"
              style={{ padding: "0.8rem 2.25rem" }}
            >
              Get Started
            </a>
            <a
              href="/sign-in"
              className="btn-iron"
              style={{ padding: "0.8rem 2.25rem" }}
            >
              Sign In
            </a>
          </div>

          {/* Security badges */}
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
                className="font-cinzel"
                style={{
                  fontSize: "0.58rem",
                  letterSpacing: "0.12em",
                  color: "rgba(200,146,42,0.5)",
                  borderBottom: "1px solid rgba(200,146,42,0.2)",
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
