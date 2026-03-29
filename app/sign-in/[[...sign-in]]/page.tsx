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
      {/* ── Left panel ──────────────────────────────────────────── */}
      <div
        className="hidden lg:flex"
        style={{
          flex: "1 1 0",
          flexDirection: "column",
          justifyContent: "center",
          padding: "5rem",
          borderRight: "1px solid rgba(0,212,255,0.08)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Vertical accent line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "5rem",
            bottom: 0,
            width: "1px",
            background:
              "linear-gradient(to bottom, transparent, rgba(0,212,255,0.14) 25%, rgba(0,212,255,0.14) 75%, transparent)",
          }}
        />

        <a
          href="/"
          className="font-orbitron"
          style={{
            fontSize: "0.62rem",
            letterSpacing: "0.32em",
            color: "rgba(0,212,255,0.45)",
            marginBottom: "1.25rem",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          ← Footprint
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

      {/* ── Right panel — Clerk card ─────────────────────────────── */}
      <div
        style={{
          flex: "1 1 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <SignIn />
      </div>
    </div>
  )
}
