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
          // Returning user — pre-load their existing selections for editing
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    )
  }

  const category = CATEGORIES[step]
  const isLastStep = step === CATEGORIES.length - 1
  const progress = ((step + 1) / CATEGORIES.length) * 100

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      {/* Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-lg p-8">

        {/* Top: logo + step count */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-base font-bold text-gray-900">🔐 Footprint</span>
          <span className="text-xs font-medium text-gray-400">
            {step + 1} / {CATEGORIES.length}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-8">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Category header */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">{category.name}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{category.description}</p>
        </div>

        {/* Service grid */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {category.services.map((service) => {
            const isChecked = selected.has(service.id)
            return (
              <button
                key={service.id}
                onClick={() => toggle(service.id)}
                className={[
                  "flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all",
                  isChecked
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-200 bg-white hover:border-gray-300",
                ].join(" ")}
              >
                <span className="text-2xl leading-none">{service.emoji}</span>
                <span
                  className={[
                    "text-sm font-medium leading-tight",
                    isChecked ? "text-indigo-700" : "text-gray-700",
                  ].join(" ")}
                >
                  {service.name}
                </span>
              </button>
            )
          })}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
          >
            ← Back
          </button>

          <div className="flex items-center gap-1.5">
            {CATEGORIES.map((_, i) => (
              <span
                key={i}
                className={[
                  "block h-1.5 rounded-full transition-all",
                  i === step
                    ? "w-5 bg-indigo-500"
                    : i < step
                    ? "w-1.5 bg-indigo-300"
                    : "w-1.5 bg-gray-200",
                ].join(" ")}
              />
            ))}
          </div>

          {isLastStep ? (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Saving…" : isEditing ? "Save changes →" : "Finish →"}
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Next →
            </button>
          )}
        </div>
      </div>

      {/* Skip / cancel link */}
      {isEditing ? (
        <a
          href="/dashboard"
          className="mt-4 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          ← Back to dashboard
        </a>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="mt-4 text-xs text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
        >
          Skip and set up later
        </button>
      )}
    </div>
  )
}
