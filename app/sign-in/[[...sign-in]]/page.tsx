import { SignIn } from "@clerk/nextjs"

export default function SignInPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "stretch",
        background: "var(--bg)",
      }}
    >
      {/* ── Left panel — vault bg + welcome copy ─────────────────── */}
      <div
        className="hidden lg:flex"
        style={{
          flex: "1 1 0",
          flexDirection: "column",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          borderRight: "1px solid rgba(200,146,42,0.1)",
        }}
      >
        {/* Ken Burns background image */}
        <div
          className="hero-bg-img"
          style={{
            backgroundImage: "url(/hero-vault.png)",
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
              "linear-gradient(to right, rgba(10,10,10,0.97) 0%, rgba(10,10,10,0.88) 45%, rgba(10,10,10,0.65) 100%)",
              "linear-gradient(rgba(10,10,10,0.2), rgba(10,10,10,0.2))",
            ].join(", "),
            zIndex: 1,
            pointerEvents: "none",
          }}
        />

        {/* Amber glow pulse */}
        <div
          style={{
            position: "absolute",
            right: "10%",
            top: "50%",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(200,146,42,0.09) 0%, transparent 65%)",
            transform: "translate(50%, -50%)",
            animation: "hero-glow-breathe 4s ease-in-out infinite",
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
                filter: "drop-shadow(0 0 8px rgba(200,146,42,0.6))",
              }}
            />
            <span
              className="font-cinzel"
              style={{
                fontSize: "0.65rem",
                letterSpacing: "0.26em",
                color: "rgba(200,146,42,0.6)",
                textTransform: "uppercase",
              }}
            >
              ← Footprint
            </span>
          </a>

          <h1
            className="font-cinzel"
            style={{
              fontSize: "clamp(2rem, 4vw, 3.75rem)",
              fontWeight: 900,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              lineHeight: 1.1,
              color: "var(--text-primary)",
              marginBottom: "1.5rem",
            }}
          >
            Welcome
            <br />
            <span style={{ color: "var(--accent)" }}>Back.</span>
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
                className="font-cinzel"
                style={{
                  fontSize: "0.58rem",
                  letterSpacing: "0.12em",
                  color: "rgba(200,146,42,0.45)",
                  borderBottom: "1px solid rgba(200,146,42,0.18)",
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
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          backgroundColor: "#1a1208",
          backgroundImage: "linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35))",
        }}
      >
        <style>{`
          .cl-formButtonPrimary,
          .cl-formButtonPrimary:hover,
          .cl-formButtonPrimary:focus,
          .cl-formButtonPrimary:active {
            background-color: #c8922a !important;
            border-color: #c8922a !important;
            color: #000000 !important;
          }
        `}</style>
        <SignIn />
      </div>
    </div>
  )
}
