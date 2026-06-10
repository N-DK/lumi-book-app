"use client"

import { useEffect, useMemo, useState } from "react"

function seededRainValue(seed: number) {
  const x = Math.sin(seed * 999) * 10000
  return x - Math.floor(x)
}

export function RainOverlay({ enabled }: { enabled: boolean }) {
  const [mounted, setMounted] = useState(false)
  const drops = useMemo(
    () =>
      Array.from({ length: 60 }).map((_, i) => ({
        id: i,
        left: seededRainValue(i + 1) * 100,
        delay: seededRainValue(i + 101) * 5,
        duration: 0.6 + seededRainValue(i + 201) * 0.8,
        height: 40 + seededRainValue(i + 301) * 60,
        opacity: 0.2 + seededRainValue(i + 401) * 0.4,
      })),
    [],
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !enabled) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {drops.map((d) => (
        <span
          key={d.id}
          className="lumi-raindrop"
          style={{
            left: `${d.left}%`,
            height: `${d.height}px`,
            opacity: d.opacity,
            animationDelay: `${d.delay}s`,
            animationDuration: `${d.duration}s`,
          }}
        />
      ))}
    </div>
  )
}
