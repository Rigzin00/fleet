import { useEffect, useRef, useState, type ReactNode } from 'react'
import { prefersReducedMotion } from '../hooks/useUi'
import { BATTERY_LOW, FUEL_LOW, STATUS_META } from '../lib/format'
import type { Severity, VehicleStatus } from '../lib/types'
import { SeverityGlyph } from './icons'

export function StatusDot({ status }: { status: VehicleStatus }) {
  return <span className={`status-dot status-${status}`} style={{ background: STATUS_META[status].color }} aria-hidden="true" />
}

export function StatusLabel({ status }: { status: VehicleStatus }) {
  const { label, color } = STATUS_META[status]
  return (
    <span className="status-label" style={{ color }}>
      <StatusDot status={status} />
      {label}
    </span>
  )
}

export function SeverityTag({ severity, children }: { severity: Severity; children?: ReactNode }) {
  return (
    <span className={`sev sev-${severity}`}>
      <SeverityGlyph severity={severity} size={12} />
      {children ?? severity}
    </span>
  )
}

/** Count that eases to its new value instead of jumping. */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)

  useEffect(() => {
    if (prefersReducedMotion() || from.current === value) {
      from.current = value
      const id = requestAnimationFrame(() => setShown(value))
      return () => cancelAnimationFrame(id)
    }
    const start = performance.now()
    const origin = from.current
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 650)
      const eased = 1 - (1 - t) ** 3
      const current = origin + (value - origin) * eased
      from.current = current
      setShown(current)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return <span className={className}>{Math.round(shown).toLocaleString('en-IN')}</span>
}

/** Fuel as a small ring: the arc length is the tank level, red once it is low. */
export function FuelRing({ pct, size = 34 }: { pct: number; size?: number }) {
  const r = 14
  const c = 2 * Math.PI * r
  const low = pct < FUEL_LOW
  return (
    <svg className={`ring ${low ? 'ring-low' : ''}`} width={size} height={size} viewBox="0 0 36 36" role="img" aria-label={`Fuel ${Math.round(pct)}%`}>
      <circle cx="18" cy="18" r={r} className="ring-track" />
      <circle cx="18" cy="18" r={r} className="ring-arc" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 18 18)" />
    </svg>
  )
}

/** Battery voltage on a 10.5–14.5 V scale, with the "low" threshold marked. */
export function VoltBar({ volts }: { volts: number }) {
  const lo = 10.5
  const hi = 14.5
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100))}%`
  return (
    <span className={`voltbar ${volts < BATTERY_LOW ? 'voltbar-low' : ''}`} role="img" aria-label={`${volts.toFixed(1)} volts`}>
      <i style={{ width: pos(volts) }} />
      <b style={{ left: pos(BATTERY_LOW) }} />
    </span>
  )
}

export function Metric({ label, value, unit, tone, sub, aside }: { label: string; value: ReactNode; unit?: string; tone?: 'bad' | 'warn'; sub?: ReactNode; aside?: ReactNode }) {
  return (
    <div className={`metric ${tone ? `metric-${tone}` : ''}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-row">
        <div className="metric-value">
          {value}
          {unit && <span className="metric-unit"> {unit}</span>}
        </div>
        {aside}
      </div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  )
}

export const batteryLow = (v: number) => v < BATTERY_LOW
