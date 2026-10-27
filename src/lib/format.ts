import { useSyncExternalStore } from 'react'
import type { VehicleStatus } from './types'

// --- shared clock so every "x ago" label ticks without each owning a timer -------------------

const listeners = new Set<() => void>()
let tick = Date.now()
let timer: number | undefined

function subscribe(fn: () => void) {
  listeners.add(fn)
  if (timer === undefined) {
    timer = window.setInterval(() => {
      tick = Date.now()
      listeners.forEach((l) => l())
    }, 5000)
  }
  return () => {
    listeners.delete(fn)
    if (listeners.size === 0 && timer !== undefined) {
      window.clearInterval(timer)
      timer = undefined
    }
  }
}
export const useNow = () => useSyncExternalStore(subscribe, () => tick)

// --- durations & times ----------------------------------------------------------------------

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem ? `${h}h ${rem}m` : `${h}h`
}

export function timeAgo(iso: string, now: number): string {
  const diff = Math.max(0, (now - new Date(iso).getTime()) / 1000)
  if (diff < 10) return 'just now'
  if (diff < 60) return `${Math.round(diff)}s ago`
  return `${formatDuration(diff)} ago`
}

export const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })

export function dayLabel(iso: string, now: number): string {
  const d = new Date(iso)
  const today = new Date(now)
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOf(today) - startOf(d)) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

export const km = (n: number, digits = 1) => `${n.toFixed(digits)} km`
export const int = (n: number) => Math.round(n).toLocaleString('en-IN')

// --- status vocabulary ----------------------------------------------------------------------

export const STATUS_META: Record<VehicleStatus, { label: string; color: string }> = {
  moving: { label: 'Moving', color: 'var(--moving)' },
  idle: { label: 'Idling', color: 'var(--idle)' },
  stopped: { label: 'Parked', color: 'var(--stopped)' },
  offline: { label: 'Offline', color: 'var(--offline)' },
  maintenance: { label: 'In service', color: 'var(--maintenance)' },
}

export const FUEL_LOW = 15
export const BATTERY_LOW = 11.9

// --- speed colouring for routes -------------------------------------------------------------

export const SPEED_COLORS = { slow: '#8fb0ff', normal: '#2457f5', over: '#e5342b' }

export function speedBand(kph: number, limit: number): 'slow' | 'normal' | 'over' {
  if (kph > limit + 2) return 'over'
  if (kph < 20) return 'slow'
  return 'normal'
}
