import { SignIn } from "@clerk/nextjs"

export default function SignInPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "stretch",
        position: "relative",
        backgroundImage: "url(/bg-onboarding.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#080808",
      }}
    >
      {/* ── Atmospheric overlays ──────────────────────────────────── */}

      {/* Dark base — heavier than landing page */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
        background: "rgba(5,5,5,0.84)" }} />

      {/* Tight overhead light source — single central ceiling beam */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 52% 26% at 50% 0%, rgba(255,255,255,0.046) 0%, transparent 100%)" }} />

      {/* Structural panel seam lines — vertical divisions */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
        background: `linear-gradient(
          90deg,
          transparent calc(33.333% - 0.5px),
          rgba(255,255,255,0.022) calc(33.333% - 0.5px),
          rgba(255,255,255,0.022) calc(33.333% + 0.5px),
          transparent calc(33.333% + 0.5px),
          transparent calc(66.666% - 0.5px),
          rgba(255,255,255,0.022) calc(66.666% - 0.5px),
          rgba(255,255,255,0.022) calc(66.666% + 0.5px),
          transparent calc(66.666% + 0.5px)
        )` }} />

      {/* Horizontal section seam — low ground line */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: "9%",
        height: "1px", zIndex: 0, pointerEvents: "none",
        background: "rgba(255,255,255,0.018)" }} />

      {/* ── Left panel — welcome copy ─────────────────────────────── */}
      <div
        className="hidden lg:flex"
        style={{
          flex: "1 1 0",
          flexDirection: "column",
          justifyContent: "center",
          position: "relative",
          zIndex: 1,
          overflow: "hidden",
          borderRight: "1px solid #222222",
        }}
      >
        {/* Neutral legibility overlay — no warm tint */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to right, rgba(5,5,5,0.92) 0%, rgba(5,5,5,0.60) 100%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", zIndex: 1, padding: "5rem" }}>
          <a
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              marginBottom: "2.5rem",
              textDecoration: "none",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Footprint"
              style={{ height: "40px", width: "auto", opacity: 0.92 }}
            />
            <span
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "0.62rem",
                letterSpacing: "0.18em",
                color: "#555",
                textTransform: "uppercase",
              }}
            >
              ← Footprint
            </span>
          </a>

          <h1
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "clamp(2rem, 4vw, 3.75rem)",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              textTransform: "uppercase",
              lineHeight: 1.1,
              color: "#ffffff",
              marginBottom: "1.5rem",
            }}
          >
            Welcome
            <br />
            Back.
          </h1>

          <p
            style={{
              fontFamily: "Inter, sans-serif",
              color: "#a0a0a0",
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
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "0.58rem",
                  fontWeight: 400,
                  letterSpacing: "0.14em",
                  color: "#555",
                  borderBottom: "1px solid #2a2a2a",
                  paddingBottom: "0.25rem",
                  textTransform: "uppercase",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel — Clerk card ──────────────────────────────── */}
      <div
        style={{
          flex: "1 1 0",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Corner bracket markers — architectural / locking reference points */}
        <div style={{ position: "absolute", top: "1.75rem", left: "1.75rem", width: "14px", height: "14px",
          borderTop: "1px solid rgba(255,255,255,0.07)", borderLeft: "1px solid rgba(255,255,255,0.07)",
          pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "1.75rem", right: "1.75rem", width: "14px", height: "14px",
          borderTop: "1px solid rgba(255,255,255,0.07)", borderRight: "1px solid rgba(255,255,255,0.07)",
          pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "1.75rem", left: "1.75rem", width: "14px", height: "14px",
          borderBottom: "1px solid rgba(255,255,255,0.07)", borderLeft: "1px solid rgba(255,255,255,0.07)",
          pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "1.75rem", right: "1.75rem", width: "14px", height: "14px",
          borderBottom: "1px solid rgba(255,255,255,0.07)", borderRight: "1px solid rgba(255,255,255,0.07)",
          pointerEvents: "none" }} />

        {/* Override all Clerk amber/brand colors to match dark neutral theme */}
        <style>{`
          .cl-card {
            background: transparent !important;
            border: 1px solid #3a3a3a !important;
            box-shadow: inset 0 1px 0 0 rgba(255,255,255,0.08) !important;
            border-radius: 0 !important;
          }
          .cl-headerTitle {
            font-family: Inter, sans-serif !important;
            color: #ffffff !important;
            font-size: 1rem !important;
            font-weight: 600 !important;
            letter-spacing: 0em !important;
            text-transform: none !important;
          }
          .cl-headerSubtitle {
            font-family: Inter, sans-serif !important;
            color: #a0a0a0 !important;
            font-size: 0.85rem !important;
          }
          .cl-formButtonPrimary,
          .cl-formButtonPrimary:hover,
          .cl-formButtonPrimary:focus,
          .cl-formButtonPrimary:active {
            background: #1a1a1a !important;
            background-color: #1a1a1a !important;
            border: 1px solid #444444 !important;
            border-color: #444444 !important;
            color: #ffffff !important;
            font-family: Inter, sans-serif !important;
            font-size: 0.72rem !important;
            font-weight: 500 !important;
            letter-spacing: 0.08em !important;
            text-transform: uppercase !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          .cl-socialButtonsBlockButton,
          .cl-socialButtonsBlockButton:hover,
          .cl-socialButtonsBlockButton:focus {
            background: #1a1a1a !important;
            background-color: #1a1a1a !important;
            border: 1px solid #333333 !important;
            border-color: #333333 !important;
            color: #e8e0d0 !important;
            border-radius: 0 !important;
            font-family: Inter, sans-serif !important;
            font-size: 0.75rem !important;
            box-shadow: none !important;
          }
          .cl-socialButtonsBlockButtonText {
            color: #e8e0d0 !important;
            font-family: Inter, sans-serif !important;
          }
          .cl-formFieldInput,
          .cl-formFieldInput:focus {
            background: #0a0a0a !important;
            background-color: #0a0a0a !important;
            border: 1px solid #333333 !important;
            border-color: #333333 !important;
            color: #ffffff !important;
            border-radius: 0 !important;
            font-family: Inter, sans-serif !important;
            box-shadow: none !important;
            outline: none !important;
          }
          .cl-formFieldInput:focus {
            border-color: #555555 !important;
          }
          .cl-formFieldLabel {
            font-family: Inter, sans-serif !important;
            color: #888888 !important;
            font-size: 0.75rem !important;
          }
          .cl-footerActionText {
            font-family: Inter, sans-serif !important;
            color: #555555 !important;
          }
          .cl-footerActionLink {
            color: #a0a0a0 !important;
            font-family: Inter, sans-serif !important;
          }
          .cl-footerActionLink:hover {
            color: #e8e0d0 !important;
          }
          .cl-dividerLine {
            background: #2a2a2a !important;
          }
          .cl-dividerText {
            color: #444444 !important;
            font-family: Inter, sans-serif !important;
          }
          .cl-identityPreviewText,
          .cl-identityPreviewEditButton {
            color: #888888 !important;
            font-family: Inter, sans-serif !important;
          }
          .cl-otpCodeFieldInput {
            background: #0a0a0a !important;
            border: 1px solid #333333 !important;
            color: #ffffff !important;
            border-radius: 0 !important;
          }
          .cl-alertText {
            color: #888888 !important;
            font-family: Inter, sans-serif !important;
          }
          .cl-formFieldSuccessText {
            color: #888888 !important;
            font-family: Inter, sans-serif !important;
          }
          .cl-badge {
            background: #1a1a1a !important;
            border: 1px solid #333 !important;
            color: #888 !important;
            border-radius: 0 !important;
          }
        `}</style>
        <SignIn />
      </div>
    </div>
  )
}
