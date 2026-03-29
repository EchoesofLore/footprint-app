"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import { CATEGORIES } from "@/lib/services"

export default function OnboardingPage() {
  const router = useRouter()
  const { isLoaded, isSignedIn } = useAuth()

  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [checking, setChecking] = useState(true)
  const [isEditing, setIsEditing] = useState(false)

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

  function toggle(serviceId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(serviceId)) next.delete(serviceId)
      else next.add(serviceId)
      return next
    })
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ services: Array.from(selected) }),
      })
      router.push("/dashboard")
    } catch {
      setSubmitting(false)
    }
  }

  if (!isLoaded || checking) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
        }}
      >
        <p
          className="font-cinzel"
          style={{
            color: "rgba(200,146,42,0.4)",
            fontSize: "0.65rem",
            letterSpacing: "0.28em",
          }}
        >
          Loading…
        </p>
      </div>
    )
  }

  const category = CATEGORIES[step]
  const isLastStep = step === CATEGORIES.length - 1
  const progress = ((step + 1) / CATEGORIES.length) * 100
  const catNum = String(step + 1).padStart(2, "0")

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundImage: "url(/bg-onboarding.png)",
        backgroundColor: "#1a1208",
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundAttachment: "fixed",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
        position: "relative",
      }}
    >
      {/* Full-page dark overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.68)",
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      {/* Card */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          backgroundImage: "linear-gradient(rgba(17,16,8,0.86), rgba(17,16,8,0.86)), url(/texture-panel.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          border: "1px solid var(--border)",
          width: "100%",
          maxWidth: "520px",
          padding: "2.5rem",
          boxShadow: "0 0 48px rgba(200,146,42,0.1)",
        }}
      >
        {/* Top row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Footprint"
              style={{
                height: "28px",
                width: "auto",
                filter: "drop-shadow(0 0 6px rgba(200,146,42,0.55))",
              }}
            />
            <span
              className="font-cinzel"
              style={{
                fontWeight: 900,
                fontSize: "0.8rem",
                letterSpacing: "0.18em",
                color: "var(--accent)",
              }}
            >
              Footprint
            </span>
          </div>
          <span
            className="font-cinzel"
            style={{
              fontSize: "0.62rem",
              letterSpacing: "0.12em",
              color: "var(--text-secondary)",
            }}
          >
            {catNum} / {String(CATEGORIES.length).padStart(2, "0")}
          </span>
        </div>

        {/* Progress bar */}
        <div className="progress-stone" style={{ marginBottom: "2.25rem" }}>
          <div
            className="progress-stone-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Category header */}
        <div style={{ marginBottom: "1.75rem" }}>
          <p
            className="font-cinzel"
            style={{
              fontSize: "0.58rem",
              letterSpacing: "0.26em",
              color: "rgba(200,146,42,0.45)",
              marginBottom: "0.5rem",
              textTransform: "uppercase",
            }}
          >
            Select Services
          </p>
          <h2
            className="font-cinzel"
            style={{
              fontSize: "1.2rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-primary)",
              marginBottom: "0.3rem",
            }}
          >
            {category.name}
          </h2>
          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--text-secondary)",
              lineHeight: 1.6,
            }}
          >
            {category.description}
          </p>
        </div>

        {/* Service grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.75rem",
            marginBottom: "2.25rem",
          }}
        >
          {category.services.map((service) => {
            const isChecked = selected.has(service.id)
            return (
              <button
                key={service.id}
                onClick={() => toggle(service.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "1rem",
                  background: isChecked ? "rgba(200,146,42,0.1)" : "var(--bg)",
                  border: `1px solid ${isChecked ? "var(--accent)" : "var(--border-subtle)"}`,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.2s, border-color 0.2s, box-shadow 0.2s",
                  boxShadow: isChecked
                    ? "0 0 12px rgba(200,146,42,0.15)"
                    : "none",
                }}
              >
                <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>
                  {service.emoji}
                </span>
                <span
                  className={isChecked ? "font-cinzel" : ""}
                  style={{
                    fontSize: isChecked ? "0.62rem" : "0.82rem",
                    fontWeight: isChecked ? 700 : 500,
                    letterSpacing: isChecked ? "0.07em" : "0",
                    color: isChecked ? "var(--accent)" : "var(--text-primary)",
                    textTransform: isChecked ? "uppercase" : "none",
                    lineHeight: 1.3,
                  }}
                >
                  {service.name}
                </span>
              </button>
            )
          })}
        </div>

        {/* Navigation */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <button
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            className="font-cinzel"
            style={{
              background: "none",
              border: "none",
              fontSize: "0.62rem",
              letterSpacing: "0.12em",
              color: "var(--text-secondary)",
              cursor: step === 0 ? "not-allowed" : "pointer",
              opacity: step === 0 ? 0.3 : 1,
              textTransform: "uppercase",
              padding: "0.5rem 0",
            }}
          >
            ← Back
          </button>

          {/* Step dots */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            {CATEGORIES.map((_, i) => (
              <span
                key={i}
                style={{
                  display: "block",
                  height: "3px",
                  borderRadius: "1px",
                  background:
                    i === step
                      ? "var(--accent)"
                      : i < step
                      ? "rgba(200,146,42,0.4)"
                      : "rgba(200,146,42,0.12)",
                  width: i === step ? "20px" : "6px",
                  boxShadow: i === step ? "0 0 6px var(--accent)" : "none",
                  transition: "width 0.3s, background 0.3s",
                }}
              />
            ))}
          </div>

          {isLastStep ? (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-iron-solid"
              style={{
                fontSize: "0.62rem",
                padding: "0.55rem 1.25rem",
                opacity: submitting ? 0.5 : 1,
              }}
            >
              {submitting ? "Saving…" : isEditing ? "Save →" : "Finish →"}
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="btn-iron-solid"
              style={{ fontSize: "0.62rem", padding: "0.55rem 1.25rem" }}
            >
              Next →
            </button>
          )}
        </div>
      </div>

      {/* Skip / cancel */}
      {isEditing ? (
        <a
          href="/dashboard"
          className="font-cinzel"
          style={{
            position: "relative",
            zIndex: 1,
            marginTop: "1.25rem",
            fontSize: "0.58rem",
            letterSpacing: "0.12em",
            color: "var(--text-muted)",
            textTransform: "uppercase",
            textDecoration: "none",
            transition: "color 0.2s",
          }}
        >
          ← Back to Dashboard
        </a>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="font-cinzel"
          style={{
            position: "relative",
            zIndex: 1,
            marginTop: "1.25rem",
            background: "none",
            border: "none",
            fontSize: "0.58rem",
            letterSpacing: "0.12em",
            color: "var(--text-muted)",
            textTransform: "uppercase",
            cursor: "pointer",
            opacity: submitting ? 0.4 : 1,
          }}
        >
          Skip for now
        </button>
      )}
    </div>
  )
}
