import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { prefersReducedMotion } from '../hooks/useUi'
import { clock, formatDuration, SPEED_COLORS, speedBand, STATUS_META } from '../lib/format'
import type { FleetPoint, Trip, TripEvent, TripPoint } from '../lib/types'
import { Icon, iconSvg, STATUS_ICON, type IconName } from './icons'

/** Space on each side of the map covered by floating panels, in px. Fits and flights aim at the free area. */
export interface Insets {
  left: number
  right: number
}

interface Props {
  fleet: FleetPoint[]
  selectedId: number | null
  speedLimit: number
  trip: Trip | null
  points: TripPoint[]
  events: TripEvent[]
  hoverIndex: number | null
  hoveredVehicleId: number | null
  focusedEvent: { event: TripEvent; nonce: number } | null
  insets: Insets
  onSelectVehicle: (id: number) => void
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

const BENGALURU: L.LatLngTuple = [12.9716, 77.5946]
const EDGE = 44

// flyToBounds (not fitBounds): Leaflet silently drops a fitBounds that arrives while a zoom animation is
// still running, which is exactly what happens when a vehicle is selected and its route loads a moment later.
// A new flight cancels the one in progress.
function fitTo(map: L.Map, latlngs: L.LatLngTuple[], insets: Insets, maxZoom: number) {
  if (latlngs.length === 0) return
  map.invalidateSize()
  const bounds = L.latLngBounds(latlngs)
  const options = {
    paddingTopLeft: L.point(insets.left + EDGE, EDGE),
    paddingBottomRight: L.point(insets.right + EDGE, EDGE + 8),
    maxZoom,
  }
  if (prefersReducedMotion()) map.fitBounds(bounds, { ...options, animate: false })
  else map.flyToBounds(bounds, { ...options, duration: 0.7 })
}

export function FleetMap(props: Props) {
  const { fleet, selectedId, speedLimit, trip, points, events, hoverIndex, hoveredVehicleId, focusedEvent, insets, onSelectVehicle } = props
  const hasRoute = selectedId !== null && points.length > 1
  return (
    <div className="map-wrap">
      <MapContainer center={BENGALURU} zoom={11} zoomControl={false} className="map">
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />
        <ResizeWatcher />
        <ZoomLabels />
        <ViewController fleet={fleet} selectedId={selectedId} points={points} tripId={trip?.id ?? null} focusedEvent={focusedEvent} insets={insets} />
        {hasRoute && <RouteLayer key={trip?.id} points={points} limit={speedLimit} finished={trip?.ended_at !== null} />}
        {hasRoute && <EventMarkers events={events} limit={speedLimit} focused={focusedEvent?.event.id ?? null} />}
        <VehicleMarkers fleet={fleet} selectedId={selectedId} hoveredId={hoveredVehicleId} onSelect={onSelectVehicle} />
        {hasRoute && hoverIndex !== null && points[hoverIndex] && (
          <CircleMarker center={[points[hoverIndex].lat, points[hoverIndex].lng]} radius={7} pathOptions={{ color: '#111827', weight: 2.5, fillColor: '#fff', fillOpacity: 1 }} interactive={false} />
        )}
        <MapControls fleet={fleet} selectedId={selectedId} points={points} insets={insets} />
      </MapContainer>
      {hasRoute && (
        <div className="map-legend" aria-hidden="true">
          <span><i style={{ background: SPEED_COLORS.slow }} /> slow</span>
          <span><i style={{ background: SPEED_COLORS.normal }} /> moving</span>
          <span><i style={{ background: SPEED_COLORS.over }} /> over limit</span>
          <span><b className="ev-dot ev-halt" /> halt</span>
          <span><b className="ev-dot ev-harsh_brake" /> hard brake</span>
        </div>
      )}
    </div>
  )
}

/** Leaflet only re-measures itself on window resize; layout changes (rotation, split view) need a nudge. */
function ResizeWatcher() {
  const map = useMap()
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(map.getContainer())
    return () => ro.disconnect()
  }, [map])
  return null
}

/** Vehicle name labels appear once zoomed in far enough for them not to collide. */
function ZoomLabels() {
  const map = useMap()
  useEffect(() => {
    const el = map.getContainer()
    const sync = () => el.classList.toggle('labels-on', map.getZoom() >= 12)
    sync()
    map.on('zoomend', sync)
    return () => {
      map.off('zoomend', sync)
    }
  }, [map])
  return null
}

/** Owns every programmatic camera move so the rest of the map can stay declarative. */
function ViewController({
  fleet,
  selectedId,
  points,
  tripId,
  focusedEvent,
  insets,
}: {
  fleet: FleetPoint[]
  selectedId: number | null
  points: TripPoint[]
  tripId: number | null
  focusedEvent: Props['focusedEvent']
  insets: Insets
}) {
  const map = useMap()
  const latest = useRef({ fleet, points, insets })
  useEffect(() => {
    latest.current = { fleet, points, insets }
  })
  const haveFleet = fleet.length > 0
  const hasRoute = points.length > 1

  // Whole fleet in view when nothing is selected (not on every refresh, so positions can update quietly).
  useEffect(() => {
    if (selectedId !== null || !haveFleet) return
    const { fleet: f, insets: i } = latest.current
    fitTo(map, f.map((v) => [v.last_lat, v.last_lng]), i, 13)
  }, [map, selectedId, haveFleet])

  // Selecting a vehicle: centre on it until its route has loaded.
  useEffect(() => {
    if (selectedId === null) return
    const { fleet: f, insets: i } = latest.current
    const v = f.find((x) => x.id === selectedId)
    if (v) fitTo(map, [[v.last_lat, v.last_lng]], i, Math.max(map.getZoom(), 14))
  }, [map, selectedId])

  // ...then frame the whole route.
  useEffect(() => {
    if (!hasRoute) return
    const { points: pts, insets: i } = latest.current
    fitTo(map, pts.map((p) => [p.lat, p.lng]), i, 16)
  }, [map, tripId, hasRoute])

  useEffect(() => {
    if (!focusedEvent) return
    const { insets: i } = latest.current
    fitTo(map, [[focusedEvent.event.lat, focusedEvent.event.lng]], i, Math.max(map.getZoom(), 16))
  }, [map, focusedEvent])

  return null
}

function MapControls({ fleet, selectedId, points, insets }: { fleet: FleetPoint[]; selectedId: number | null; points: TripPoint[]; insets: Insets }) {
  const map = useMap()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    L.DomEvent.disableClickPropagation(ref.current)
    L.DomEvent.disableScrollPropagation(ref.current)
  }, [])

  function fit() {
    if (points.length > 1) return fitTo(map, points.map((p) => [p.lat, p.lng]), insets, 16)
    const sel = fleet.find((v) => v.id === selectedId)
    if (sel) return fitTo(map, [[sel.last_lat, sel.last_lng]], insets, 15)
    fitTo(map, fleet.map((v) => [v.last_lat, v.last_lng]), insets, 13)
  }

  const btn = (label: string, icon: IconName, onClick: () => void) => (
    <button type="button" onClick={onClick} aria-label={label} title={label}>
      <Icon name={icon} size={17} />
    </button>
  )

  return (
    <div className="map-controls" ref={ref}>
      {btn('Zoom in', 'plus', () => map.zoomIn())}
      {btn('Zoom out', 'minus', () => map.zoomOut())}
      {btn(points.length > 1 ? 'Fit route' : selectedId ? 'Centre on vehicle' : 'Fit fleet', 'fit', fit)}
    </div>
  )
}

const VehicleMarker = memo(function VehicleMarker({ v, selected, dim, hot, onSelect }: { v: FleetPoint; selected: boolean; dim: boolean; hot: boolean; onSelect: (id: number) => void }) {
  const icon = useMemo(() => {
    const attn = v.top_alert_severity ? `attn attn-${v.top_alert_severity}` : ''
    const glyph = iconSvg(STATUS_ICON[v.status], 14, 2.2)
    const inner = v.status === 'moving' ? `<span class="vm-glyph" style="transform:rotate(${v.last_heading}deg)">${glyph}</span>` : `<span class="vm-glyph">${glyph}</span>`
    const label = escapeHtml(v.name)
    return L.divIcon({
      className: 'vm-wrap',
      html: `<div class="vm ${selected ? 'sel' : ''} ${dim ? 'dim' : ''} ${hot ? 'hot' : ''} ${attn}" style="--c:${STATUS_META[v.status].color}">${inner}<span class="vm-label">${label}</span></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    })
  }, [v.status, v.last_heading, v.name, v.top_alert_severity, selected, dim, hot])

  return (
    <Marker
      position={[v.last_lat, v.last_lng]}
      icon={icon}
      zIndexOffset={selected ? 1000 : hot ? 900 : v.top_alert_severity ? 500 : 0}
      eventHandlers={{ click: () => onSelect(v.id) }}
      keyboard
      title={`${v.name} · ${v.reg_number}`}
    >
      <Tooltip direction="top" offset={[0, -16]} opacity={1} className="tip">
        <b>{v.name}</b> <span className="tip-dim">{v.reg_number}</span>
        <br />
        <span style={{ color: STATUS_META[v.status].color }}>
          {STATUS_META[v.status].label}
          {v.status === 'moving' ? ` · ${Math.round(v.last_speed_kph)} km/h` : ''}
        </span>
      </Tooltip>
    </Marker>
  )
})

const VehicleMarkers = memo(function VehicleMarkers({ fleet, selectedId, hoveredId, onSelect }: { fleet: FleetPoint[]; selectedId: number | null; hoveredId: number | null; onSelect: (id: number) => void }) {
  return (
    <>
      {fleet.map((v) => (
        <VehicleMarker key={v.id} v={v} selected={v.id === selectedId} dim={selectedId !== null && v.id !== selectedId} hot={v.id === hoveredId} onSelect={onSelect} />
      ))}
    </>
  )
})

/** 0 → total over ~0.7 s, restarting when `key` changes; jumps straight to the end for reduced motion. */
function useReveal(total: number, key: unknown): number {
  const [state, setState] = useState({ key, n: 0 })
  useEffect(() => {
    if (prefersReducedMotion()) {
      const id = requestAnimationFrame(() => setState({ key, n: total }))
      return () => cancelAnimationFrame(id)
    }
    const start = performance.now()
    let raf = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 700)
      setState({ key, n: Math.max(2, Math.round((1 - (1 - t) ** 3) * total)) })
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [key, total])
  return state.key === key ? state.n : 0
}

const endIcon = (label: string, cls: string) => L.divIcon({ className: 'end-wrap', html: `<div class="end ${cls}">${label}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] })
const START_ICON = endIcon('A', 'end-a')
const END_ICON = endIcon('B', 'end-b')

/** The route, drawn in on arrival as runs of the same speed band over a white casing. */
const RouteLayer = memo(function RouteLayer({ points, limit, finished }: { points: TripPoint[]; limit: number; finished: boolean }) {
  const shown = useReveal(points.length, points[0]?.recorded_at)
  const visible = useMemo(() => points.slice(0, shown), [points, shown])
  const runs = useMemo(() => {
    const out: { band: keyof typeof SPEED_COLORS; path: L.LatLngTuple[] }[] = []
    for (let i = 1; i < visible.length; i++) {
      const band = speedBand(visible[i].speed_kph, limit)
      const a: L.LatLngTuple = [visible[i - 1].lat, visible[i - 1].lng]
      const b: L.LatLngTuple = [visible[i].lat, visible[i].lng]
      const last = out[out.length - 1]
      if (last && last.band === band) last.path.push(b)
      else out.push({ band, path: [a, b] })
    }
    return out
  }, [visible, limit])
  const all = useMemo(() => visible.map((p) => [p.lat, p.lng] as L.LatLngTuple), [visible])
  const done = shown >= points.length

  return (
    <>
      {all.length > 1 && <Polyline positions={all} pathOptions={{ color: '#fff', weight: 9, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }} interactive={false} />}
      {runs.map((r, i) => (
        <Polyline key={i} positions={r.path} pathOptions={{ color: SPEED_COLORS[r.band], weight: r.band === 'over' ? 6 : 5, opacity: 1, lineCap: 'round', lineJoin: 'round' }} interactive={false} />
      ))}
      {all.length > 0 && <Marker position={[points[0].lat, points[0].lng]} icon={START_ICON} interactive={false} />}
      {done && finished && <Marker position={[points[points.length - 1].lat, points[points.length - 1].lng]} icon={END_ICON} interactive={false} />}
    </>
  )
})

const pin = (cls: string, icon: IconName) => L.divIcon({ className: 'ev-wrap', html: `<div class="ev-pin ev-${cls}">${iconSvg(icon, 12, 2.4)}</div>`, iconSize: [24, 24], iconAnchor: [12, 12] })
const EVENT_ICONS: Record<TripEvent['kind'], L.DivIcon> = {
  overspeed: pin('overspeed', 'gauge'),
  halt: pin('halt', 'pause'),
  harsh_brake: pin('harsh_brake', 'alert'),
}

const EventMarkers = memo(function EventMarkers({ events, limit, focused }: { events: TripEvent[]; limit: number; focused: number | null }) {
  return (
    <>
      {events.map((e) => (
        <Marker key={`${e.id}-${e.id === focused}`} position={[e.lat, e.lng]} icon={EVENT_ICONS[e.kind]} zIndexOffset={e.id === focused ? 900 : 300}>
          <Tooltip direction="top" offset={[0, -12]} opacity={1} permanent={e.id === focused} className="tip">
            <b>{e.kind === 'overspeed' ? 'Overspeed' : e.kind === 'halt' ? 'Halt' : 'Hard braking'}</b>{' '}
            {e.kind === 'overspeed' && `${Math.round(e.value)} km/h (limit ${limit}) for ${formatDuration(e.duration_s)}`}
            {e.kind === 'halt' && `stopped ${formatDuration(e.value)}`}
            {e.kind === 'harsh_brake' && `from ${Math.round(e.value)} km/h`}
            <br />
            <span className="tip-dim">{clock(e.occurred_at)}</span>
          </Tooltip>
        </Marker>
      ))}
    </>
  )
})
