"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import { ALL_SERVICES, CATEGORIES } from "@/lib/services"

type DiscoveryMethod = "manual" | "csv" | "file" | null

type Suggestion = {
  id: string
  name: string
  category: string
  source: "email" | "curated" | "manual"
}

// ── Helper: manual-add row (defined outside to avoid remount on each render) ──
function AddManualRow({ onAdd }: { onAdd: (name: string) => void }) {
  const [val, setVal] = useState("")
  function submit() {
    if (!val.trim()) return
    onAdd(val.trim())
    setVal("")
  }
  return (
    <div style={{ display: "flex", gap: "0.5rem" }}>
      <input
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Add a service manually…"
        style={{
          flex: 1,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.12)",
          padding: "0.55rem 0.875rem",
          fontSize: "0.78rem",
          color: "#e8e0d0",
          fontFamily: "Inter, sans-serif",
          outline: "none",
        }}
      />
      <button
        onClick={submit}
        style={{
          background: "none",
          border: "1px solid rgba(255,255,255,0.2)",
          color: "rgba(255,255,255,0.5)",
          fontSize: "0.6rem",
          letterSpacing: "0.1em",
          padding: "0.55rem 0.875rem",
          cursor: "pointer",
          fontFamily: "Cinzel, serif",
          textTransform: "uppercase",
        }}
      >
        Add
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const { isLoaded, isSignedIn } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── State ──────────────────────────────────────────────────────────────────

  // Existing state (preserved)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [checking, setChecking] = useState(true)
  const [isEditing, setIsEditing] = useState(false)

  // New state machine
  const [step, setStep] = useState(0)
  const [emails, setEmails] = useState<string[]>([])
  const [emailInput, setEmailInput] = useState("")
  const [discoveryMethod, setDiscoveryMethod] = useState<DiscoveryMethod>(null)
  const [csvText, setCsvText] = useState("")
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [confirmed, setConfirmed] = useState<string[]>([])
  const [manualInput, setManualInput] = useState("")

  // ── Effects ────────────────────────────────────────────────────────────────

  // Auth check + existing-onboarding detection (preserved)
  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      router.replace("/")
      return
    }
    fetch("/api/onboarding")
      .then((r) => r.json())
      .then((data) => {
        if (data.completed) {
          setSelected(new Set(data.services as string[]))
          setIsEditing(true)
        }
        setChecking(false)
      })
      .catch(() => setChecking(false))
  }, [isLoaded, isSignedIn, router])

  // Auto-redirect on step 5
  useEffect(() => {
    if (step !== 5) return
    const t = setTimeout(() => router.push("/dashboard"), 2000)
    return () => clearTimeout(t)
  }, [step, router])

  // Build suggestions when entering step 3
  useEffect(() => {
    if (step !== 3) return
    const emailDomains = emails
      .map((e) => e.split("@")[1]?.toLowerCase().split(".")[0])
      .filter(Boolean)

    const built: Suggestion[] = ALL_SERVICES.map((s) => {
      const matched = emailDomains.some((d) =>
        s.name.toLowerCase().includes(d as string)
      )
      return {
        id: s.id,
        name: s.name,
        category: s.category,
        source: matched ? ("email" as const) : ("curated" as const),
      }
    })

    setSuggestions(built)
    setSelected(new Set(built.map((s) => s.id)))
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ───────────────────────────────────────────────────────────────

  function addEmail() {
    const val = emailInput.trim()
    if (!val || emails.includes(val)) return
    setEmails((prev) => [...prev, val])
    setEmailInput("")
  }

  function removeEmail(email: string) {
    setEmails((prev) => prev.filter((e) => e !== email))
  }

  function toggleSuggestion(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function addManualSuggestion(name: string) {
    const id = `manual_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`
    const sugg: Suggestion = { id, name, category: "Other", source: "manual" }
    setSuggestions((prev) => [...prev, sugg])
    setSelected((prev) => new Set([...prev, id]))
  }

  function removeConfirmed(id: string) {
    setConfirmed((prev) => prev.filter((c) => c !== id))
  }

  function proceedToConfirm() {
    setConfirmed(Array.from(selected))
    setStep(4)
  }

  // Existing POST logic (preserved)
  async function handleSubmit() {
    setSubmitting(true)
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ services: confirmed }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Unknown error" }))
        console.error("[onboarding] POST failed", res.status, body)
        setSubmitting(false)
        return
      }
      setStep(5)
    } catch (err) {
      console.error("[onboarding] POST threw", err)
      setSubmitting(false)
    }
  }

  // ── Loading screen ─────────────────────────────────────────────────────────

  if (!isLoaded || checking) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          backgroundImage: "url('/bg-dashboard.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <p
          className="font-cinzel"
          style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.65rem", letterSpacing: "0.28em" }}
        >
          Loading…
        </p>
      </div>
    )
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const progress = step === 0 ? 0 : step >= 5 ? 100 : (step / 5) * 100

  // Shared class strings
  const primaryBtn =
    "font-cinzel border border-white/25 text-white/70 text-xs tracking-widest px-6 py-3 hover:bg-white/5 transition-all cursor-pointer bg-transparent"
  const disabledBtn =
    "font-cinzel border border-white/10 text-white/20 text-xs tracking-widest px-6 py-3 cursor-not-allowed bg-transparent"

  const panelStyle: React.CSSProperties = {
    background: "#0d0d0d",
    border: "1px solid rgba(255,255,255,0.15)",
    width: "100%",
    maxWidth: "520px",
    padding: "2.5rem",
  }

  // Shared full-page wrapper (background texture on all steps)
  const outerWrap: React.CSSProperties = {
    minHeight: "100vh",
    background: "#0a0a0a",
    backgroundImage: "url('/bg-dashboard.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem 1rem",
  }

  // ── Step 0: Welcome ────────────────────────────────────────────────────────

  if (step === 0) {
    return (
      <div style={outerWrap}>
        <div style={{ textAlign: "center", maxWidth: "400px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Footprint"
            style={{
              height: "56px",
              width: "auto",
              marginBottom: "2rem",
              filter: "drop-shadow(0 0 20px rgba(255,255,255,0.15))",
            }}
          />
          <h1
            className="font-cinzel"
            style={{
              fontSize: "clamp(1.1rem, 4vw, 1.55rem)",
              fontWeight: 700,
              letterSpacing: "0.18em",
              color: "#ffffff",
              textTransform: "uppercase",
              marginBottom: "1rem",
            }}
          >
            Your Vault Awaits
          </h1>
          <p
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "0.88rem",
              color: "rgba(255,255,255,0.5)",
              lineHeight: 1.75,
              marginBottom: "2.5rem",
            }}
          >
            Let&apos;s discover and secure your accounts in a few steps.
          </p>
          <button
            onClick={() => setStep(1)}
            className="font-cinzel border border-white/30 text-white/80 text-xs tracking-widest px-6 py-3 hover:bg-white/5 transition-all cursor-pointer bg-transparent"
          >
            Begin Setup →
          </button>
          {isEditing && (
            <div style={{ marginTop: "1.75rem" }}>
              <a
                href="/dashboard"
                className="font-cinzel"
                style={{
                  fontSize: "0.58rem",
                  letterSpacing: "0.12em",
                  color: "rgba(255,255,255,0.3)",
                  textTransform: "uppercase",
                  textDecoration: "none",
                }}
              >
                ← Back to Dashboard
              </a>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Step 5: Complete ───────────────────────────────────────────────────────

  if (step === 5) {
    return (
      <div style={outerWrap}>
        <div style={{ textAlign: "center", maxWidth: "400px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Footprint"
            style={{
              height: "56px",
              width: "auto",
              marginBottom: "2rem",
              filter: "drop-shadow(0 0 20px rgba(255,255,255,0.15))",
            }}
          />
          <h1
            className="font-cinzel"
            style={{
              fontSize: "clamp(1.1rem, 4vw, 1.55rem)",
              fontWeight: 700,
              letterSpacing: "0.18em",
              color: "#e8e0d0",
              textTransform: "uppercase",
              marginBottom: "1rem",
            }}
          >
            Vault Secured
          </h1>
          <p
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "0.88rem",
              color: "rgba(232,224,208,0.45)",
              lineHeight: 1.75,
              marginBottom: "2rem",
            }}
          >
            Your accounts have been added. Welcome to Footprint.
          </p>
          <p
            className="font-cinzel"
            style={{
              fontSize: "0.55rem",
              letterSpacing: "0.22em",
              color: "rgba(255,255,255,0.3)",
              textTransform: "uppercase",
            }}
          >
            Redirecting…
          </p>
        </div>
      </div>
    )
  }

  // ── Steps 1–4: panel layout ────────────────────────────────────────────────

  return (
    <div style={outerWrap}>
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
        }}
      >
        {/* Progress bar */}
        <div style={{ marginBottom: "1.25rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "0.5rem",
            }}
          >
            <span
              className="font-cinzel"
              style={{
                fontSize: "0.55rem",
                letterSpacing: "0.2em",
                color: "rgba(255,255,255,0.3)",
                textTransform: "uppercase",
              }}
            >
              Step {step} of 5
            </span>
            <span
              className="font-cinzel"
              style={{
                fontSize: "0.55rem",
                letterSpacing: "0.2em",
                color: "rgba(255,255,255,0.3)",
              }}
            >
              {String(step).padStart(2, "0")} / 05
            </span>
          </div>
          <div
            style={{
              height: "2px",
              background: "rgba(255,255,255,0.08)",
              width: "100%",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: "rgba(255,255,255,0.4)",
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </div>

        {/* Back button */}
        <button
          onClick={() => setStep((s) => s - 1)}
          className="font-cinzel"
          style={{
            background: "none",
            border: "none",
            fontSize: "0.6rem",
            letterSpacing: "0.12em",
            color: "rgba(255,255,255,0.3)",
            cursor: "pointer",
            textTransform: "uppercase",
            padding: "0.25rem 0",
            marginBottom: "0.75rem",
            alignSelf: "flex-start",
          }}
        >
          ← Back
        </button>

        {/* Panel */}
        <div style={panelStyle}>

          {/* ── Step 1: Email Input ──────────────────────────────────────── */}
          {step === 1 && (
            <>
              <h2
                className="font-cinzel"
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  color: "#e8e0d0",
                  textTransform: "uppercase",
                  marginBottom: "0.6rem",
                }}
              >
                Identify Your Accounts
              </h2>
              <p
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "0.82rem",
                  color: "rgba(232,224,208,0.4)",
                  lineHeight: 1.7,
                  marginBottom: "1.75rem",
                }}
              >
                Add the email addresses you use to sign into services.
              </p>

              {/* Input row */}
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addEmail()}
                  placeholder="you@example.com"
                  style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    padding: "0.6rem 0.875rem",
                    fontSize: "0.82rem",
                    color: "#e8e0d0",
                    fontFamily: "Inter, sans-serif",
                    outline: "none",
                  }}
                />
                <button
                  onClick={addEmail}
                  className={primaryBtn}
                  style={{ padding: "0.6rem 1rem", fontSize: "0.6rem" }}
                >
                  Add
                </button>
              </div>

              {/* Email pills */}
              {emails.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                    marginBottom: "1.75rem",
                  }}
                >
                  {emails.map((email) => (
                    <span
                      key={email}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        padding: "0.3rem 0.75rem",
                        fontSize: "0.75rem",
                        color: "rgba(232,224,208,0.65)",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      {email}
                      <button
                        onClick={() => removeEmail(email)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "rgba(255,255,255,0.35)",
                          cursor: "pointer",
                          fontSize: "0.85rem",
                          padding: 0,
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: emails.length === 0 ? "1rem" : 0,
                }}
              >
                <button
                  onClick={() => setStep(2)}
                  disabled={emails.length === 0}
                  className={emails.length === 0 ? disabledBtn : primaryBtn}
                >
                  Continue →
                </button>
              </div>
            </>
          )}

          {/* ── Step 2: Discovery Method ─────────────────────────────────── */}
          {step === 2 && (
            <>
              <h2
                className="font-cinzel"
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  color: "#e8e0d0",
                  textTransform: "uppercase",
                  marginBottom: "0.6rem",
                }}
              >
                Discover Accounts
              </h2>
              <p
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "0.82rem",
                  color: "rgba(232,224,208,0.4)",
                  lineHeight: 1.7,
                  marginBottom: "1.75rem",
                }}
              >
                How would you like to discover your accounts?
              </p>

              {/* Option cards */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.65rem",
                  marginBottom: "1.5rem",
                }}
              >
                {(
                  [
                    { id: "manual", label: "Manual", desc: "Add accounts one by one" },
                    { id: "csv", label: "Import CSV", desc: "Paste exported browser passwords" },
                    { id: "file", label: "Upload File", desc: "Upload a browser password export file" },
                  ] as Array<{ id: "manual" | "csv" | "file"; label: string; desc: string }>
                ).map((opt) => {
                  const isActive = discoveryMethod === opt.id
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setDiscoveryMethod(opt.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "1rem 1.25rem",
                        textAlign: "left",
                        cursor: "pointer",
                        background: isActive
                          ? "rgba(255,255,255,0.04)"
                          : "rgba(255,255,255,0.02)",
                        border: `1px solid ${
                          isActive
                            ? "rgba(255,255,255,0.25)"
                            : "rgba(255,255,255,0.06)"
                        }`,
                        transition: "background 0.2s, border-color 0.2s",
                      }}
                    >
                      <div>
                        <div
                          className={isActive ? "font-cinzel" : ""}
                          style={{
                            fontSize: isActive ? "0.65rem" : "0.85rem",
                            fontWeight: isActive ? 700 : 400,
                            letterSpacing: isActive ? "0.1em" : "0",
                            color: isActive ? "rgba(255,255,255,0.9)" : "#e8e0d0",
                            textTransform: isActive ? "uppercase" : "none",
                            fontFamily: isActive ? undefined : "Inter, sans-serif",
                          }}
                        >
                          {opt.label}
                        </div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "rgba(232,224,208,0.35)",
                            marginTop: "0.2rem",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          {opt.desc}
                        </div>
                      </div>
                      {isActive && (
                        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "1.2rem" }}>
                          ›
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* CSV textarea */}
              {discoveryMethod === "csv" && (
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="Paste CSV content here…"
                  style={{
                    width: "100%",
                    height: "120px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    padding: "0.75rem",
                    fontSize: "0.75rem",
                    color: "#e8e0d0",
                    fontFamily: "monospace",
                    outline: "none",
                    resize: "vertical",
                    marginBottom: "1rem",
                    boxSizing: "border-box",
                  }}
                />
              )}

              {/* File input */}
              {discoveryMethod === "file" && (
                <div style={{ marginBottom: "1rem" }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.json"
                    style={{ display: "none" }}
                    onChange={() => {}}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={primaryBtn}
                    style={{ fontSize: "0.6rem", padding: "0.6rem 1.25rem" }}
                  >
                    Choose File
                  </button>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setStep(3)}
                  disabled={!discoveryMethod}
                  className={!discoveryMethod ? disabledBtn : primaryBtn}
                >
                  Continue →
                </button>
              </div>
            </>
          )}

          {/* ── Step 3: Suggestions ──────────────────────────────────────── */}
          {step === 3 && (
            <>
              <h2
                className="font-cinzel"
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  color: "#e8e0d0",
                  textTransform: "uppercase",
                  marginBottom: "0.5rem",
                }}
              >
                Accounts Detected
              </h2>
              <p
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "0.8rem",
                  color: "rgba(232,224,208,0.4)",
                  lineHeight: 1.7,
                  marginBottom: "1.25rem",
                }}
              >
                <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                  {selected.size} account{selected.size !== 1 ? "s" : ""}
                </span>{" "}
                selected
              </p>

              {/* Suggestions list */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.35rem",
                  maxHeight: "300px",
                  overflowY: "auto",
                  marginBottom: "1rem",
                  paddingRight: "0.25rem",
                }}
              >
                {suggestions.map((s) => {
                  const isOn = selected.has(s.id)
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleSuggestion(s.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.65rem 1rem",
                        textAlign: "left",
                        cursor: "pointer",
                        background: isOn
                          ? "rgba(255,255,255,0.04)"
                          : "rgba(255,255,255,0.02)",
                        border: `1px solid ${
                          isOn
                            ? "rgba(255,255,255,0.2)"
                            : "rgba(255,255,255,0.05)"
                        }`,
                        transition: "background 0.15s, border-color 0.15s",
                      }}
                    >
                      <div>
                        <span
                          style={{
                            fontSize: "0.82rem",
                            color: isOn ? "#e8e0d0" : "rgba(232,224,208,0.5)",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          {s.name}
                        </span>
                        <span
                          style={{
                            fontSize: "0.65rem",
                            color: "rgba(255,255,255,0.3)",
                            fontFamily: "Inter, sans-serif",
                            marginLeft: "0.6rem",
                          }}
                        >
                          {s.category}
                          {s.source === "email" && (
                            <span style={{ marginLeft: "0.4rem", color: "rgba(255,255,255,0.5)" }}>
                              · email match
                            </span>
                          )}
                          {s.source === "manual" && (
                            <span style={{ marginLeft: "0.4rem", color: "rgba(255,255,255,0.5)" }}>
                              · manual
                            </span>
                          )}
                        </span>
                      </div>
                      <span
                        style={{
                          width: "15px",
                          height: "15px",
                          border: `1px solid ${
                            isOn ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.12)"
                          }`,
                          background: isOn ? "rgba(255,255,255,0.1)" : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          fontSize: "0.55rem",
                          color: "rgba(255,255,255,0.7)",
                        }}
                      >
                        {isOn && "✓"}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Add manually */}
              <AddManualRow onAdd={addManualSuggestion} />

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.25rem" }}>
                <button onClick={proceedToConfirm} className={primaryBtn}>
                  Continue →
                </button>
              </div>
            </>
          )}

          {/* ── Step 4: Confirm ──────────────────────────────────────────── */}
          {step === 4 && (
            <>
              <h2
                className="font-cinzel"
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  color: "#e8e0d0",
                  textTransform: "uppercase",
                  marginBottom: "0.6rem",
                }}
              >
                Review Your Vault
              </h2>
              <p
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "0.82rem",
                  color: "rgba(232,224,208,0.4)",
                  lineHeight: 1.7,
                  marginBottom: "1.5rem",
                }}
              >
                {confirmed.length} account{confirmed.length !== 1 ? "s" : ""} ready to secure.
              </p>

              {/* Grouped by category */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.25rem",
                  maxHeight: "320px",
                  overflowY: "auto",
                  marginBottom: "1.5rem",
                  paddingRight: "0.25rem",
                }}
              >
                {(() => {
                  const items = confirmed.map((id) => {
                    const match = suggestions.find((s) => s.id === id)
                    return match ?? { id, name: id, category: "Other", source: "manual" as const }
                  })

                  const catMap = new Map<string, typeof items>()
                  // Use CATEGORIES order for grouping
                  CATEGORIES.forEach((c) => catMap.set(c.name, []))
                  catMap.set("Other", [])
                  for (const item of items) {
                    const key = item.category
                    if (!catMap.has(key)) catMap.set(key, [])
                    catMap.get(key)!.push(item)
                  }

                  return [...catMap.entries()]
                    .filter(([, rows]) => rows.length > 0)
                    .map(([cat, rows]) => (
                      <div key={cat}>
                        <div
                          className="font-cinzel"
                          style={{
                            fontSize: "0.58rem",
                            letterSpacing: "0.2em",
                            color: "rgba(255,255,255,0.3)",
                            textTransform: "uppercase",
                            marginBottom: "0.5rem",
                          }}
                        >
                          {cat}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                          {rows.map((item) => (
                            <div
                              key={item.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "0.55rem 0.875rem",
                                background: "rgba(255,255,255,0.02)",
                                border: "1px solid rgba(255,255,255,0.08)",
                              }}
                            >
                              <div>
                                <span
                                  style={{
                                    fontSize: "0.82rem",
                                    color: "#e8e0d0",
                                    fontFamily: "Inter, sans-serif",
                                  }}
                                >
                                  {item.name}
                                </span>
                                {emails[0] && (
                                  <span
                                    style={{
                                      fontSize: "0.65rem",
                                      color: "rgba(232,224,208,0.28)",
                                      fontFamily: "Inter, sans-serif",
                                      marginLeft: "0.65rem",
                                    }}
                                  >
                                    {emails[0]}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => removeConfirmed(item.id)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "rgba(232,224,208,0.22)",
                                  cursor: "pointer",
                                  fontSize: "0.9rem",
                                  padding: "0 0.25rem",
                                  lineHeight: 1,
                                }}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                })()}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || confirmed.length === 0}
                  className={
                    submitting || confirmed.length === 0 ? disabledBtn : primaryBtn
                  }
                >
                  {submitting ? "Securing…" : "Secure My Vault →"}
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
