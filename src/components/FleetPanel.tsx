import { useEffect, useMemo, type RefObject } from 'react'
import { PAGE_SIZE } from '../hooks/useFleetData'
import type { Polled } from '../hooks/usePolled'
import { formatDuration, STATUS_META, useNow } from '../lib/format'
import { MAX_QUERY_LENGTH } from '../lib/sanitize'
import type { FleetPoint, Page, Vehicle, VehicleFilter } from '../lib/types'
import { AlertSection } from './AlertSection'
import { Icon, Illustration, VehicleGlyph } from './icons'
import { AnimatedNumber } from './ui'

export type PanelTab = 'vehicles' | 'alerts'

const FILTERS: { id: VehicleFilter; label: string; match: (v: FleetPoint) => boolean }[] = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'attention', label: 'Attention', match: (v) => v.open_alerts > 0 },
  { id: 'moving', label: 'Moving', match: (v) => v.status === 'moving' },
  { id: 'idle', label: 'Idling', match: (v) => v.status === 'idle' },
  { id: 'parked', label: 'Parked', match: (v) => v.status === 'stopped' || v.status === 'maintenance' },
  { id: 'offline', label: 'Offline', match: (v) => v.status === 'offline' },
]

interface Props {
  snapshot: FleetPoint[]
  page: Polled<Page<Vehicle>>
  filter: VehicleFilter
  search: string
  selectedId: number | null
  tab: PanelTab
  searchRef: RefObject<HTMLInputElement | null>
  onTab: (t: PanelTab) => void
  onFilter: (f: VehicleFilter) => void
  onSearch: (s: string) => void
  onMore: () => void
  onSelect: (id: number) => void
  onHover: (id: number | null) => void
  onAcknowledge: (alertId: number) => Promise<void>
}

export function FleetPanel(p: Props) {
  const { snapshot, page, filter, search, selectedId, tab, searchRef } = p

  const counts = useMemo(() => {
    const c = {} as Record<VehicleFilter, number>
    for (const f of FILTERS) c[f.id] = snapshot.filter(f.match).length
    return c
  }, [snapshot])
  const openAlerts = useMemo(() => snapshot.reduce((n, v) => n + v.open_alerts, 0), [snapshot])
  const distance = useMemo(() => snapshot.reduce((n, v) => n + v.distance_24h_km, 0), [snapshot])

  const rows = page.data?.rows ?? []
  const total = page.data?.total ?? 0

  // keep the selected row visible when it changes through the keyboard or the map
  useEffect(() => {
    if (selectedId === null) return
    document.querySelector(`[data-vehicle-id="${selectedId}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [selectedId, rows.length])

  return (
    <div className="fleet">
      <div className="stats">
        <div>
          <AnimatedNumber value={counts.moving} className="stat-num" />
          <span>moving <i>of {snapshot.length}</i></span>
        </div>
        <div>
          <AnimatedNumber value={distance} className="stat-num" />
          <span>km <i>in 24 h</i></span>
        </div>
        <div className={openAlerts > 0 ? 'stat-alert' : ''}>
          <AnimatedNumber value={openAlerts} className="stat-num" />
          <span>open <i>alerts</i></span>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Fleet views" data-active={tab}>
        <button role="tab" id="tab-vehicles" aria-selected={tab === 'vehicles'} onClick={() => p.onTab('vehicles')}>
          Vehicles
        </button>
        <button role="tab" id="tab-alerts" aria-selected={tab === 'alerts'} onClick={() => p.onTab('alerts')}>
          Alerts {openAlerts > 0 && <span className="count">{openAlerts}</span>}
        </button>
        <span className="tab-ind" aria-hidden="true" />
      </div>

      {tab === 'vehicles' ? (
        <div className="tabpanel" role="tabpanel" aria-labelledby="tab-vehicles">
          <label className="search">
            <Icon name="search" size={15} />
            <input
              ref={searchRef}
              value={search}
              maxLength={MAX_QUERY_LENGTH}
              onChange={(e) => p.onSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation()
                  if (search) p.onSearch('')
                  else e.currentTarget.blur()
                }
              }}
              placeholder="Search vehicle, plate or driver"
              aria-label="Search vehicles"
              spellCheck={false}
              autoComplete="off"
            />
            {search ? (
              <button type="button" className="search-clear" onClick={() => p.onSearch('')} aria-label="Clear search">
                <Icon name="close" size={13} />
              </button>
            ) : (
              <kbd>/</kbd>
            )}
          </label>

          <div className="filters" role="group" aria-label="Filter vehicles">
            {FILTERS.map((f) => (
              <button key={f.id} className={`filter ${filter === f.id ? 'on' : ''} ${f.id === 'attention' && counts.attention ? 'filter-warn' : ''}`} onClick={() => p.onFilter(f.id)} aria-pressed={filter === f.id}>
                {f.label}
                <span>{counts[f.id]}</span>
              </button>
            ))}
          </div>

          <div className={`vlist-wrap ${page.stale ? 'is-stale' : ''}`}>
            {page.error && !page.data && <div className="banner banner-error">Couldn’t load vehicles: {page.error}</div>}
            {page.error && page.data && <div className="banner banner-error">Couldn’t refresh — showing the last data.</div>}
            {page.loading && !page.data && (
              <div aria-busy="true">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="skeleton skeleton-row" />
                ))}
              </div>
            )}

            <ul className="vlist">
              {rows.map((v) => (
                <VehicleRow key={v.id} v={v} selected={v.id === selectedId} onSelect={p.onSelect} onHover={p.onHover} />
              ))}
            </ul>

            {page.data && rows.length === 0 && (
              <div className="empty">
                <Illustration kind="search" />
                <b>No vehicles match</b>
                <span>Try a different search or filter.</span>
                {(search || filter !== 'all') && (
                  <button className="btn btn-quiet btn-small" onClick={() => { p.onSearch(''); p.onFilter('all') }}>
                    Clear filters
                  </button>
                )}
              </div>
            )}

            {rows.length > 0 && rows.length < total && (
              <button className="more" onClick={p.onMore}>
                Show {Math.min(PAGE_SIZE.vehicles, total - rows.length)} more <span>{rows.length} of {total}</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="tabpanel tabpanel-scroll" role="tabpanel" aria-labelledby="tab-alerts">
          <AlertSection onSelectVehicle={p.onSelect} onAcknowledge={p.onAcknowledge} />
        </div>
      )}
    </div>
  )
}

function statusLine(v: Vehicle, now: number): string {
  const since = (now - new Date(v.status_since).getTime()) / 1000
  switch (v.status) {
    case 'moving':
      return `Moving · ${Math.round(v.last_speed_kph)} km/h`
    case 'idle':
      return `Idling ${formatDuration(since)}`
    case 'stopped':
      return `Parked ${formatDuration(since)}`
    case 'offline':
      return `No signal ${formatDuration(since)}`
    case 'maintenance':
      return 'In service'
  }
}

function VehicleRow({ v, selected, onSelect, onHover }: { v: Vehicle; selected: boolean; onSelect: (id: number) => void; onHover: (id: number | null) => void }) {
  const now = useNow()
  const color = STATUS_META[v.status].color
  return (
    <li>
      <button
        className={`vrow ${selected ? 'selected' : ''}`}
        data-vehicle-id={v.id}
        aria-current={selected ? 'true' : undefined}
        onClick={() => onSelect(v.id)}
        onMouseEnter={() => onHover(v.id)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(v.id)}
        onBlur={() => onHover(null)}
      >
        <span className="vrow-icon" style={{ ['--c' as string]: color }}>
          <VehicleGlyph kind={v.kind} size={19} />
        </span>
        <span className="vrow-main">
          <span className="vrow-name">
            {v.name}
            <small>{v.reg_number}</small>
          </span>
          <span className="vrow-sub">
            <span style={{ color }}>{statusLine(v, now)}</span>
            <span> · {v.driver_name ?? 'Unassigned'}</span>
          </span>
          {v.top_alert_title && (
            <span className={`vrow-reason sev-text-${v.top_alert_severity ?? 'info'}`}>
              {v.top_alert_title}
              {v.open_alerts > 1 && <em> +{v.open_alerts - 1}</em>}
            </span>
          )}
        </span>
        {v.top_alert_severity && <span className={`vrow-dot sev-bg-${v.top_alert_severity}`} title={`${v.open_alerts} open alert${v.open_alerts > 1 ? 's' : ''}`} />}
      </button>
    </li>
  )
}
