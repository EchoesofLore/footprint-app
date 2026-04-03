import { SignIn } from "@clerk/nextjs"

export default function SignInPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        backgroundImage: "url(/bg-login.png)",
        backgroundSize: "cover",
        backgroundPosition: "center center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#0a0a0a",
      }}
    >
      {/* ── Dark overlay ──────────────────────────────────────────── */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
        background: "rgba(0,0,0,0.35)" }} />

      {/* ── Logo — top left ───────────────────────────────────────── */}
      <div style={{ position: "relative", zIndex: 1, padding: "2rem 2.5rem", flexShrink: 0 }}>
        <a
          href="/"
          style={{ display: "flex", alignItems: "center", gap: "0.75rem", textDecoration: "none" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Footprint"
            style={{ height: "52px", width: "auto", opacity: 0.92 }}
          />
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "0.75rem",
              letterSpacing: "0.18em",
              color: "#555",
              textTransform: "uppercase",
            }}
          >
            ← Footprint
          </span>
        </a>
      </div>

      {/* ── Centered content stack ────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          zIndex: 1,
          padding: "2rem 1rem 4rem",
        }}
      >
        {/* Heading */}
        <h1
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "clamp(2rem, 4vw, 3.75rem)",
            fontWeight: 700,
            letterSpacing: "-0.01em",
            lineHeight: 1.1,
            color: "#efefef",
            marginBottom: "2rem",
            textAlign: "center",
          }}
        >
          Access your vault
        </h1>

        {/* Sign-in form */}
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

        {/* Supporting sentence */}
        <p
          style={{
            fontFamily: "Inter, sans-serif",
            color: "#a0a0a0",
            fontSize: "0.9rem",
            lineHeight: 1.78,
            maxWidth: "380px",
            marginTop: "2rem",
            textAlign: "center",
          }}
        >
          Your encrypted vault is waiting. Sign in to access and manage all
          your accounts securely.
        </p>

        {/* Trust labels */}
        <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", justifyContent: "center", marginTop: "1.5rem" }}>
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
  )
}
