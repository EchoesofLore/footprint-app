"use client"
import { useEffect, useState } from "react"

interface Particle {
  left: string
  bottom: string
  delay: string
  duration: string
  size: string
}

export default function Particles({ count = 28 }: { count?: number }) {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    setParticles(
      Array.from({ length: count }, () => ({
        left: `${Math.random() * 100}%`,
        bottom: `${Math.random() * 15}%`,
        delay: `${Math.random() * 14}s`,
        duration: `${9 + Math.random() * 13}s`,
        size: Math.random() > 0.65 ? "3px" : "2px",
      }))
    )
  }, [count])

  return (
    <div className="particles-container" aria-hidden="true">
      {particles.map((p, i) => (
        <span
          key={i}
          className="particle"
          style={{
            left: p.left,
            bottom: p.bottom,
            animationDelay: p.delay,
            animationDuration: p.duration,
            width: p.size,
            height: p.size,
          }}
        />
      ))}
    </div>
  )
}
