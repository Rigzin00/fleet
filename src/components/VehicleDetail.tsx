import { Fragment, useMemo } from 'react'
import { PAGE_SIZE } from '../hooks/useFleetData'
import type { Polled } from '../hooks/usePolled'
import { clock, dayLabel, formatDuration, FUEL_LOW, int, km, STATUS_META, timeAgo, useNow } from '../lib/format'
import type { Page, Trip, TripEvent, TripPoint, Vehicle } from '../lib/types'
import { AlertSection } from './AlertSection'
import { Icon, Illustration, VehicleGlyph } from './icons'
import { SpeedChart } from './SpeedChart'
import { batteryLow, FuelRing, Metric, StatusLabel, VoltBar } from './ui'

const NO_TRIPS: Trip[] = []

interface Props {
  vehicle: Vehicle
  trips: Polled<Page<Trip>>
  selectedTripId: number | null
  detail: Polled<{ points: TripPoint[]; events: TripEvent[] }>
  hoverIndex: number | null
  onHover: (i: number | null) => void
  onSelectTrip: (id: number) => void
  onMoreTrips: () => void
  onFocusEvent: (e: TripEvent) => void
  onAcknowledge: (id: number) => Promise<void>
  onClose: () => void
}

export function VehicleDetail(p: Props) {
  const { vehicle: v } = p
  const now = useNow()
  const live = v.status === 'moving'
  const toService = v.next_service_km - v.odometer_km
  const trips = p.trips.data?.rows ?? NO_TRIPS
  const totalTrips = p.trips.data?.total ?? 0

  const grouped = useMemo(() => {
    const groups: { label: string; trips: Trip[] }[] = []
    for (const t of trips) {
      const label = dayLabel(t.started_at, now)
      const last = groups[groups.length - 1]
      if (last?.label === label) last.trips.push(t)
      else groups.push({ label, trips: [t] })
    }
    return groups
  }, [trips, now])

  return (
    <div className="detail" role="region" aria-label={`${v.name} details`}>
      <header className="detail-head">
        <span className="detail-icon" style={{ ['--c' as string]: STATUS_META[v.status].color }}>
          <VehicleGlyph kind={v.kind} size={24} />
        </span>
        <div className="detail-id">
          <div className="detail-title">
            <h2>{v.name}</h2>
            <StatusLabel status={v.status} />
          </div>
          <div className="detail-sub">
            <span className="plate">{v.reg_number}</span> · {v.make_model}
          </div>
        </div>
        <button className="icon-btn" onClick={p.onClose} aria-label="Close vehicle details" title="Close (Esc)">
          <Icon name="close" size={18} />
        </button>
      </header>

      <div className="detail-scroll">
        <div className="driver">
          <span>
            <Icon name="user" size={15} /> {v.driver_name ?? 'No driver assigned'}
          </span>
          {v.driver_phone && (
            <a className="link" href={`tel:${v.driver_phone.replace(/[^\d+]/g, '')}`}>
              <Icon name="phone" size={13} /> {v.driver_phone}
            </a>
          )}
        </div>

        <section>
          <h3>Alerts</h3>
          <AlertSection vehicleId={v.id} onAcknowledge={p.onAcknowledge} />
        </section>

        <section>
          <h3>Right now</h3>
          <div className="metrics">
            <Metric
              label={live ? 'Speed' : 'Last seen'}
              value={live ? Math.round(v.last_speed_kph) : timeAgo(v.last_seen_at, now)}
              unit={live ? 'km/h' : undefined}
              tone={v.status === 'offline' ? 'bad' : live && v.last_speed_kph > v.speed_limit_kph ? 'bad' : undefined}
              sub={live ? `limit ${v.speed_limit_kph}` : `${STATUS_META[v.status].label.toLowerCase()} since ${clock(v.status_since)}`}
            />
            <Metric label="Ignition" value={v.ignition ? 'On' : 'Off'} tone={v.status === 'idle' ? 'warn' : undefined} sub={v.status === 'idle' ? 'engine running' : undefined} />
            <Metric label="Last 24 h" value={int(v.distance_24h_km)} unit="km" tone={v.overspeed_24h >= 3 ? 'warn' : undefined} sub={`${v.trips_24h} trips · ${v.overspeed_24h} overspeed`} />
            <Metric label="Fuel" value={`${Math.round(v.fuel_pct)}%`} tone={v.fuel_pct < FUEL_LOW ? 'bad' : undefined} aside={<FuelRing pct={v.fuel_pct} size={30} />} sub={v.fuel_pct < FUEL_LOW ? 'refuel soon' : 'ok'} />
            <Metric label="Battery" value={v.battery_v.toFixed(1)} unit="V" tone={batteryLow(v.battery_v) ? 'bad' : undefined} sub={<VoltBar volts={v.battery_v} />} />
            <Metric label="Service in" value={toService > 0 ? int(toService) : 'Overdue'} unit={toService > 0 ? 'km' : undefined} tone={toService <= 250 ? 'warn' : undefined} sub={`odometer ${int(v.odometer_km)}`} />
          </div>
        </section>

        <section>
          <h3>
            Trips {totalTrips > 0 && <span className="muted">{totalTrips}</span>}
          </h3>
          {p.trips.error && !p.trips.data && <div className="banner banner-error">Couldn’t load trips: {p.trips.error}</div>}
          {p.trips.loading && !p.trips.data && <div className="skeleton skeleton-tall" />}
          {p.trips.data && trips.length === 0 && (
            <div className="empty empty-inline">
              <Illustration kind="trips" />
              <b>No trips yet</b>
              <span>Trips appear here once the vehicle starts moving.</span>
            </div>
          )}

          <div className="trips">
            {grouped.map((g) => (
              <Fragment key={g.label}>
                <div className="day">{g.label}</div>
                {g.trips.map((t) => {
                  const selected = t.id === p.selectedTripId
                  const isLive = t.ended_at === null && live
                  const lost = t.ended_at === null && v.status === 'offline'
                  return (
                    <div key={t.id} className={`trip ${selected ? 'selected' : ''}`}>
                      <button className="trip-row" onClick={() => p.onSelectTrip(t.id)} aria-expanded={selected}>
                        <span className="trip-time">
                          {clock(t.started_at)}
                          <small>{isLive ? 'live' : lost ? 'lost' : clock(t.ended_at as string)}</small>
                        </span>
                        <span className="trip-route">
                          <span>{t.start_name}</span>
                          <Icon name="chevronRight" size={11} />
                          <span>{t.end_name}</span>
                        </span>
                        <span className="trip-side">
                          <b>{km(t.distance_km)}</b>
                          <span className="marks">
                            {isLive && <span className="mark mark-live" title="In progress">live</span>}
                            {lost && <span className="mark mark-over" title="Signal lost during this trip">no signal</span>}
                            {t.overspeed_count > 0 && <span className="mark mark-over" title={`${t.overspeed_count} overspeed events`}>{t.overspeed_count}</span>}
                            {t.harsh_brake_count > 0 && <span className="mark mark-brake" title={`${t.harsh_brake_count} hard-braking events`}>{t.harsh_brake_count}</span>}
                          </span>
                        </span>
                      </button>
                      {selected && <TripDetail trip={t} limit={v.speed_limit_kph} live={isLive} {...p} />}
                    </div>
                  )
                })}
              </Fragment>
            ))}
          </div>

          {trips.length > 0 && trips.length < totalTrips && (
            <button className="more" onClick={p.onMoreTrips}>
              Show {Math.min(PAGE_SIZE.trips, totalTrips - trips.length)} more <span>{trips.length} of {totalTrips}</span>
            </button>
          )}
        </section>
      </div>
    </div>
  )
}

const EVENT_LABEL = { overspeed: 'Overspeed', halt: 'Halt', harsh_brake: 'Hard braking' } as const

function TripDetail({ trip, limit, live, detail, hoverIndex, onHover, onFocusEvent }: Props & { trip: Trip; limit: number; live: boolean }) {
  const idlePct = trip.duration_s ? Math.round((trip.idle_s / trip.duration_s) * 100) : 0
  const points = detail.data?.points ?? []
  const events = detail.data?.events ?? []
  return (
    <div className="trip-detail">
      <div className="metrics metrics-compact">
        <Metric label="Distance" value={trip.distance_km.toFixed(1)} unit="km" sub={live ? 'so far' : undefined} />
        <Metric label="Duration" value={formatDuration(trip.duration_s)} />
        <Metric label="Avg speed" value={Math.round(trip.avg_speed_kph)} unit="km/h" />
        <Metric label="Max speed" value={Math.round(trip.max_speed_kph)} unit="km/h" tone={trip.max_speed_kph > limit + 2 ? 'bad' : undefined} sub={`limit ${limit}`} />
        <Metric label="Idle" value={formatDuration(trip.idle_s)} tone={idlePct >= 35 ? 'warn' : undefined} sub={`${idlePct}% of trip`} />
        <Metric label="Halts" value={trip.halt_count} sub="over 1 min" />
      </div>

      {detail.error && !detail.data && <div className="banner banner-error">Couldn’t load the route: {detail.error}</div>}
      {detail.loading && !detail.data ? (
        <div className="skeleton skeleton-tall" />
      ) : (
        <>
          <SpeedChart key={trip.id} points={points} limit={limit} hoverIndex={hoverIndex} onHover={onHover} />
          {events.length > 0 && (
            <ul className="events">
              {events.map((e) => (
                <li key={e.id}>
                  <button onClick={() => onFocusEvent(e)} title="Show on map">
                    <span className={`ev-dot ev-${e.kind}`} />
                    <span className="ev-name">{EVENT_LABEL[e.kind]}</span>
                    <span className="ev-val">
                      {e.kind === 'overspeed' && `${Math.round(e.value)} km/h · ${formatDuration(e.duration_s)}`}
                      {e.kind === 'halt' && formatDuration(e.value)}
                      {e.kind === 'harsh_brake' && `from ${Math.round(e.value)} km/h`}
                    </span>
                    <time>{clock(e.occurred_at)}</time>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
