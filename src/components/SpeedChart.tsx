import { useId, useMemo } from 'react'
import { clock } from '../lib/format'
import type { TripPoint } from '../lib/types'

interface Props {
  points: TripPoint[]
  limit: number
  hoverIndex: number | null
  onHover: (i: number | null) => void
}

const W = 400
const H = 118
const PAD = { l: 28, r: 6, t: 8, b: 18 }

/** Speed over the course of a trip. Hovering/scrubbing it moves a marker along the route on the map. */
export function SpeedChart({ points, limit, hoverIndex, onHover }: Props) {
  const uid = useId()
  const clipId = `${uid}-clip`
  const gradId = `${uid}-grad`
  const geometry = useMemo(() => {
    if (points.length < 2) return null
    const t0 = new Date(points[0].recorded_at).getTime()
    const t1 = new Date(points[points.length - 1].recorded_at).getTime()
    const maxY = Math.max(limit * 1.25, ...points.map((p) => p.speed_kph)) * 1.05
    const x = (i: number) => PAD.l + ((new Date(points[i].recorded_at).getTime() - t0) / (t1 - t0 || 1)) * (W - PAD.l - PAD.r)
    const y = (v: number) => PAD.t + (1 - v / maxY) * (H - PAD.t - PAD.b)
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.speed_kph).toFixed(1)}`).join('')
    const area = `${line}L${x(points.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`
    const top = Math.floor(maxY / 10) * 10
    const ticks = [...new Set([0, Math.round(top / 2 / 10) * 10, top])]
    return { x, y, line, area, limitY: y(limit), ticks }
  }, [points, limit])

  if (!geometry) return <div className="chart-empty">Not enough GPS points to chart.</div>

  const { x, y, line, area, limitY, ticks } = geometry
  const hover = hoverIndex !== null ? points[hoverIndex] : null

  function pointerToIndex(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(x(i) - px)
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    return best
  }

  return (
    <div
      className="chart"
      onPointerMove={(e) => onHover(pointerToIndex(e))}
      onPointerDown={(e) => onHover(pointerToIndex(e))}
      onPointerLeave={() => onHover(null)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Speed profile, limit ${limit} km/h`}>
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width={W} height={limitY} />
          </clipPath>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--brand)" stopOpacity="0.18" />
            <stop offset="1" stopColor="var(--brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="grid" />
            <text x={PAD.l - 5} y={y(t) + 3} textAnchor="end" className="axis">{t}</text>
          </g>
        ))}
        <path d={area} className="area" fill={`url(#${gradId})`} />
        <path d={line} className="line" pathLength={1} />
        <path d={line} className="line line-over" pathLength={1} clipPath={`url(#${clipId})`} />
        <line x1={PAD.l} x2={W - PAD.r} y1={limitY} y2={limitY} className="limit" />
        <text x={W - PAD.r} y={limitY - 3} textAnchor="end" className="limit-label">limit {limit}</text>
        <text x={PAD.l} y={H - 4} className="axis">{clock(points[0].recorded_at)}</text>
        <text x={W - PAD.r} y={H - 4} textAnchor="end" className="axis">{clock(points[points.length - 1].recorded_at)}</text>
        {hover && hoverIndex !== null && (
          <g>
            <line x1={x(hoverIndex)} x2={x(hoverIndex)} y1={PAD.t} y2={H - PAD.b} className="cursor" />
            <circle cx={x(hoverIndex)} cy={y(hover.speed_kph)} r="3.5" className="cursor-dot" />
          </g>
        )}
      </svg>
      {hover && hoverIndex !== null && (
        <div className="chart-tip" style={{ left: `${(x(hoverIndex) / W) * 100}%` }}>
          <b>{Math.round(hover.speed_kph)} km/h</b> · {clock(hover.recorded_at)}
        </div>
      )}
      <input
        className="sr-only"
        type="range"
        min={0}
        max={points.length - 1}
        value={hoverIndex ?? 0}
        onChange={(e) => onHover(Number(e.target.value))}
        onBlur={() => onHover(null)}
        aria-label="Scrub along the trip"
      />
    </div>
  )
}
