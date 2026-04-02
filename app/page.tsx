import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { createSupabaseUserClient } from "@/lib/supabaseUser"

export default async function Home() {
  const { userId, getToken } = await auth()

  if (userId) {
    const token = await getToken({ template: "supabase" })
    if (token) {
      const supabase = createSupabaseUserClient(token)
      const { data } = await supabase
        .from("user_onboarding")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle()

      redirect(data ? "/dashboard" : "/onboarding")
    }
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
        style={{
          flexShrink: 0,
          position: "relative",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 2.5rem",
          background: "rgba(10,10,10,0.72)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Footprint"
            style={{ height: "32px", width: "auto", opacity: 0.9 }}
          />
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 600,
              fontSize: "0.95rem",
              letterSpacing: "0.12em",
              color: "#e8e0d0",
              textTransform: "uppercase",
            }}
          >
            Footprint
          </span>
        </div>

        <a
          href="/sign-in"
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "0.72rem",
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#e8e0d0",
            background: "#1a1a1a",
            border: "1px solid #444",
            padding: "0.55rem 1.4rem",
            textDecoration: "none",
            transition: "filter 0.2s",
          }}
        >
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

        {/* Gradient overlay — even dark coverage across full image */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(rgba(10,10,10,0.55), rgba(10,10,10,0.55))",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />

        {/* Centered content */}
        <div
          style={{
            position: "relative",
            zIndex: 3,
            maxWidth: "600px",
            margin: "0 auto",
            textAlign: "center",
            alignItems: "center",
            display: "flex",
            flexDirection: "column",
            paddingLeft: "1.5rem",
            paddingRight: "1.5rem",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Footprint"
            style={{ height: "64px", width: "auto", marginBottom: "2rem", opacity: 0.92 }}
          />

          <p
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "0.6rem",
              fontWeight: 400,
              letterSpacing: "0.45em",
              color: "#a0a0a0",
              marginBottom: "1.5rem",
              textTransform: "uppercase",
            }}
          >
            Encrypted Password Manager
          </p>

          <h1
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "clamp(2rem, 4.5vw, 4rem)",
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: "-0.01em",
              textTransform: "uppercase",
              color: "#ffffff",
              marginBottom: "1.5rem",
            }}
          >
            Every Account.
            <br />
            Secured.
          </h1>

          <p
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "1rem",
              color: "rgba(232,224,208,0.55)",
              lineHeight: 1.8,
              maxWidth: "430px",
              marginBottom: "2.75rem",
            }}
          >
            End-to-end encrypted. Zero knowledge architecture.
            Your master password never leaves your device.
          </p>

          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
            <a
              href="/sign-in"
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "0.72rem",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#ffffff",
                background: "#1a1a1a",
                border: "1px solid #555",
                padding: "0.8rem 2.25rem",
                textDecoration: "none",
                transition: "filter 0.2s",
              }}
            >
              Get Started
            </a>
            <a
              href="/sign-in"
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "0.72rem",
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#e8e0d0",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.12)",
                padding: "0.8rem 2.25rem",
                textDecoration: "none",
                transition: "filter 0.2s",
              }}
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
              justifyContent: "center",
            }}
          >
            {["AES-256-GCM", "PBKDF2 100K", "Zero Knowledge"].map((tag) => (
              <span
                key={tag}
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "0.6rem",
                  fontWeight: 400,
                  letterSpacing: "0.14em",
                  color: "#777",
                  borderBottom: "1px solid #333",
                  paddingBottom: "0.3rem",
                  textTransform: "uppercase",
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
