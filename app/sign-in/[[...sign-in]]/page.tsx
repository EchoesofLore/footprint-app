import { SignIn } from "@clerk/nextjs"

export default function SignInPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "var(--bg)",
      }}
    >
      {/* ── Left panel — logo bg + welcome copy ─────────────────── */}
      <div
        className="hidden lg:flex"
        style={{
          flex: "1 1 0",
          flexDirection: "column",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          borderRight: "1px solid rgba(0,212,255,0.08)",
        }}
      >
        {/* Animated Ken Burns background image */}
        <div
          className="hero-bg-img"
          style={{
            backgroundImage: "url(/logo.png)",
            backgroundPosition: "center center",
            animationDuration: "28s",
          }}
        />

        {/* Dark overlays for text legibility */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: [
              "linear-gradient(to right, rgba(3,9,18,0.97) 0%, rgba(3,9,18,0.88) 45%, rgba(3,9,18,0.65) 100%)",
              "linear-gradient(rgba(3,9,18,0.25), rgba(3,9,18,0.25))",
            ].join(", "),
            zIndex: 1,
            pointerEvents: "none",
          }}
        />

        {/* Subtle glow pulse */}
        <div
          style={{
            position: "absolute",
            right: "10%",
            top: "50%",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(0,212,255,0.09) 0%, transparent 65%)",
            transform: "translate(50%, -50%)",
            animation: "hero-glow-breathe 3s ease-in-out infinite",
            pointerEvents: "none",
            zIndex: 2,
          }}
        />

        {/* Content */}
        <div
          style={{
            position: "relative",
            zIndex: 3,
            padding: "5rem",
          }}
        >
          <a
            href="/"
            style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "2rem", textDecoration: "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Footprint"
              style={{
                height: "32px",
                width: "auto",
                filter: "drop-shadow(0 0 8px rgba(0,212,255,0.6))",
              }}
            />
            <span
              className="font-orbitron"
              style={{
                fontSize: "0.62rem",
                letterSpacing: "0.32em",
                color: "rgba(0,212,255,0.55)",
                textTransform: "uppercase",
              }}
            >
              ← Footprint
            </span>
          </a>

          <h1
            className="font-orbitron"
            style={{
              fontSize: "clamp(2rem, 4vw, 3.75rem)",
              fontWeight: 900,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              lineHeight: 1.08,
              color: "var(--text-primary)",
              marginBottom: "1.5rem",
            }}
          >
            WELCOME
            <br />
            <span style={{ color: "var(--accent)" }}>BACK.</span>
          </h1>

          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.95rem",
              lineHeight: 1.78,
              maxWidth: "360px",
              marginBottom: "3rem",
            }}
          >
            Your encrypted vault is waiting. Sign in to access and manage all
            your accounts securely.
          </p>

          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
            {["AES-256-GCM", "Zero Knowledge", "PBKDF2"].map((tag) => (
              <span
                key={tag}
                className="font-orbitron"
                style={{
                  fontSize: "0.55rem",
                  letterSpacing: "0.14em",
                  color: "rgba(0,212,255,0.38)",
                  borderBottom: "1px solid rgba(0,212,255,0.14)",
                  paddingBottom: "0.25rem",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel — Clerk card ─────────────────────────────── */}
      <div
        style={{
          flex: "1 1 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          background: "var(--bg)",
        }}
      >
        <SignIn />
      </div>
    </div>
  )
}
