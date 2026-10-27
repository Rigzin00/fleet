import type { Severity, VehicleStatus } from '../lib/types'

// A hand-drawn icon set on a 24px grid (1.8 stroke, round caps). Paths live in one table so the same
// artwork renders as a React component and as an HTML string for Leaflet's divIcon markers.

const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`

const PATHS = {
  // interface
  search: 'M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13ZM20 20l-4.2-4.2',
  close: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  chevronRight: 'M9.5 6l6 6-6 6',
  chevronDown: 'M6 9.5l6 6 6-6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  fit: 'M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15M12 12h.01',
  alert: 'M12 4.2 3.3 19.1a.9.9 0 0 0 .8 1.4h15.8a.9.9 0 0 0 .8-1.4L12 4.2ZM12 10v4.2M12 17.4h.01',
  info: `${circle(12, 12, 9)}M12 11v5M12 8h.01`,
  signout: 'M14 4.5h3.5A1.5 1.5 0 0 1 19 6v12a1.5 1.5 0 0 1-1.5 1.5H14M10 16.5 14.5 12 10 7.5M14.5 12H5',
  phone: 'M6.3 4h2.5l1.4 3.6-1.8 1.2a10 10 0 0 0 5.8 5.8l1.2-1.8 3.6 1.4v2.5a1.8 1.8 0 0 1-1.9 1.8A14 14 0 0 1 4.5 5.9 1.8 1.8 0 0 1 6.3 4Z',
  user: `${circle(12, 8.4, 3.6)}M5 19.6c.6-3.2 3.4-5 7-5s6.4 1.8 7 5`,
  clock: `${circle(12, 12, 9)}M12 7.5V12l3 2`,
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM12 14.8a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6Z',
  eyeOff: 'M4 4l16 16M9.9 5.7A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.8M6.3 7.6A15.7 15.7 0 0 0 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1M10.2 10.2a2.8 2.8 0 0 0 3.6 3.6',
  keyboard: 'M4.5 6.5h15A1.5 1.5 0 0 1 21 8v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16V8a1.5 1.5 0 0 1 1.5-1.5ZM7 10h.01M10 10h.01M13 10h.01M16 10h.01M8 14h8',
  undo: 'M9.5 6.5 5 11l4.5 4.5M5.5 11H14a5 5 0 0 1 0 10h-2',
  route: `${circle(6, 17, 2)}${circle(18, 7, 2)}M8 17h6.5a3 3 0 0 0 0-6h-5a3 3 0 0 1 0-6H16`,
  // telemetry
  fuel: 'M5 20V5.5A1.5 1.5 0 0 1 6.5 4h6A1.5 1.5 0 0 1 14 5.5V20M4 20h11M14 9.5h2a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 0 3 0V8.5L18 6M7.5 8h4',
  battery: 'M4 7.5h13a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1ZM20.5 11v2M7 10.5v3M10.5 10.5v3',
  gauge: 'M4.6 17a8 8 0 1 1 14.8 0M12 15l3.6-4.6',
  // status glyphs (drawn on the map markers)
  navigate: 'M12 4.5 18.2 19 12 15.8 5.8 19 12 4.5Z',
  pause: 'M9.2 7v10M14.8 7v10',
  parking: 'M9.5 18V6.5h4a3.2 3.2 0 0 1 0 6.4h-4',
  signalOff: 'M4 4l16 16M5.2 10.2a10.5 10.5 0 0 1 3.6-2.4M18.8 10.2a10.5 10.5 0 0 0-5-2.6M8.6 13.6a5.8 5.8 0 0 1 2.1-1.2M15.4 13.6a5.8 5.8 0 0 0-1.5-1.1M12 17.4h.01',
  wrench: 'M14.6 5.4a4 4 0 0 0 4.9 5l-1.7 1.7-2.5-.4-.4-2.5 1.7-1.7M13.8 11.2 5.7 19.3a1.6 1.6 0 0 1-2.3-2.3l8.1-8.1',
  // vehicles
  van: `M2.8 16.8V8.4c0-.7.5-1.2 1.2-1.2h9.4c.4 0 .8.2 1 .5l2.7 3.4h2.7c.7 0 1.2.5 1.2 1.2v4.5M2.8 16.8h2.3M8.9 16.8h6.2M18.9 16.8h2.3${circle(7, 16.8, 1.9)}${circle(17, 16.8, 1.9)}`,
  truck: `M2.5 15.8V6.8c0-.6.4-1 1-1h10c.6 0 1 .4 1 1v9M14.5 9.4h3.2c.3 0 .6.1.8.4l2.2 2.7c.1.2.2.4.2.6v2.7M2.5 15.8h1.9M8.6 15.8h6.8M19.6 15.8h1.9${circle(6.5, 15.8, 2.1)}${circle(17.5, 15.8, 2.1)}`,
  pickup: `M2.8 16.5v-3c0-.5.3-.9.8-1l2.3-.7 2.2-3c.2-.3.5-.4.8-.4h3.2v8.1M11.1 9.4h9.4c.5 0 .9.4.9.9v6.2M2.8 16.5h2.5M9.1 16.5h6.2M19.1 16.5h2.3${circle(7.2, 16.5, 1.9)}${circle(17.2, 16.5, 1.9)}`,
  car: `M3 15.6v-2.8c0-.6.4-1.1.9-1.3l1.9-.6 2-3.1c.2-.3.6-.5 1-.5h5.6c.4 0 .7.2.9.5l1.9 3.1 2.1.6c.6.2 1 .7 1 1.3v2.8M3 15.6h1.9M9.1 15.6h5.8M19.1 15.6H21${circle(7, 15.6, 2.1)}${circle(17, 15.6, 2.1)}`,
} as const

export type IconName = keyof typeof PATHS
const FILLED = new Set<IconName>(['navigate'])

/** Markup for contexts that can't render React (Leaflet divIcons). */
export function iconSvg(name: IconName, size = 16, stroke = 1.8): string {
  const filled = FILLED.has(name)
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${PATHS[name]}"/></svg>`
}

export function Icon({ name, size = 16, stroke = 1.8, className }: { name: IconName; size?: number; stroke?: number; className?: string }) {
  const filled = FILLED.has(name)
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  )
}

export const VEHICLE_ICON = { van: 'van', truck: 'truck', pickup: 'pickup', car: 'car' } as const
export const STATUS_ICON: Record<VehicleStatus, IconName> = {
  moving: 'navigate',
  idle: 'pause',
  stopped: 'parking',
  offline: 'signalOff',
  maintenance: 'wrench',
}

export function VehicleGlyph({ kind, size = 18 }: { kind: keyof typeof VEHICLE_ICON; size?: number }) {
  return <Icon name={VEHICLE_ICON[kind]} size={size} stroke={1.6} />
}

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--brand)" />
      <path d="M8.5 22.5 14 15l4 3.6 5.5-8" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="23.5" cy="10.6" r="2.7" fill="#fff" />
    </svg>
  )
}

export function SeverityGlyph({ severity, size = 14 }: { severity: Severity; size?: number }) {
  return <Icon name={severity === 'info' ? 'info' : 'alert'} size={size} stroke={2} />
}

/** Quiet empty-state artwork. Strokes use currentColor so the surrounding text colour tints them. */
export function Illustration({ kind }: { kind: 'clear' | 'search' | 'trips' | 'error' }) {
  return (
    <svg className="illustration" width="88" height="72" viewBox="0 0 88 72" fill="none" aria-hidden="true">
      {kind === 'clear' && (
        <>
          <circle cx="44" cy="36" r="30" className="ill-soft" />
          <circle cx="44" cy="36" r="21" className="ill-line" strokeDasharray="2 5" />
          <path d="M44 17l15 5.6v10.2c0 9-6.2 15.4-15 18.6-8.8-3.2-15-9.6-15-18.6V22.6L44 17Z" className="ill-fill" />
          <path d="m37.5 35.5 4.8 4.8 8.7-9.6" className="ill-accent" />
        </>
      )}
      {kind === 'search' && (
        <>
          <circle cx="44" cy="36" r="30" className="ill-soft" />
          <circle cx="40" cy="33" r="13" className="ill-fill" />
          <path d="m50 43 10 10" className="ill-accent" />
          <path d="M34 33h12M37 38h6" className="ill-line" />
        </>
      )}
      {kind === 'trips' && (
        <>
          <circle cx="44" cy="36" r="30" className="ill-soft" />
          <path d="M26 52c8-2 6-14 16-14s6 14 20 4" className="ill-line" strokeDasharray="2 5" />
          <circle cx="26" cy="52" r="4.5" className="ill-fill" />
          <path d="M62 42c0-8 8-9 8-16a8 8 0 1 0-16 0c0 7 8 8 8 16Z" transform="translate(-10 -6) scale(.9)" className="ill-accent" />
        </>
      )}
      {kind === 'error' && (
        <>
          <circle cx="44" cy="36" r="30" className="ill-soft" />
          <path d="M44 20 66 56H22L44 20Z" className="ill-fill" />
          <path d="M44 34v10M44 50h.01" className="ill-accent" />
        </>
      )}
    </svg>
  )
}
