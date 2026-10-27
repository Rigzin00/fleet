import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PAGE_SIZE, useFleetSnapshot, useTripDetail, useTripPage, useVehicle, useVehiclePage } from '../hooks/useFleetData'
import { useRoute } from '../hooks/useRoute'
import { isTypingTarget, useDebounced, useMediaQuery } from '../hooks/useUi'
import { acknowledgeAlert, unacknowledgeAlert } from '../lib/api'
import { invalidate } from '../lib/invalidate'
import { timeAgo, useNow } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { FleetPoint, TripEvent, TripPoint, VehicleFilter } from '../lib/types'
import { AccountMenu } from './AccountMenu'
import { FleetMap } from './FleetMap'
import { FleetPanel, type PanelTab } from './FleetPanel'
import { Icon, Illustration, LogoMark } from './icons'
import { useToast } from './Toast'
import { VehicleDetail } from './VehicleDetail'

// Keep in step with --list-w / --detail-w and the card margin in index.css.
const LIST_INSET = 372 + 16
const DETAIL_INSET = 420 + 16
const NO_FLEET: FleetPoint[] = []
const NO_POINTS: TripPoint[] = []
const NO_EVENTS: TripEvent[] = []

export function Dashboard({ session }: { session: Session }) {
  const toast = useToast()
  const now = useNow()
  const desktop = useMediaQuery('(min-width: 961px)')
  const [route, navigate] = useRoute()
  const selectedId = route.vehicle

  // list state: filter + search run in the database; the page grows with "show more"
  const [tab, setTab] = useState<PanelTab>('vehicles')
  const [filter, setFilter] = useState<VehicleFilter>('all')
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState<number>(PAGE_SIZE.vehicles)
  const debouncedSearch = useDebounced(search, 250)
  const searchRef = useRef<HTMLInputElement>(null)

  const snapshot = useFleetSnapshot()
  const page = useVehiclePage(filter, debouncedSearch, limit)
  const vehicle = useVehicle(selectedId)
  const fleet = snapshot.data ?? NO_FLEET

  // trips: paginated per vehicle
  const [tripPaging, setTripPaging] = useState({ vehicleId: -1, limit: PAGE_SIZE.trips as number })
  const tripLimit = tripPaging.vehicleId === selectedId ? tripPaging.limit : PAGE_SIZE.trips
  const growTrips = useCallback(
    () => setTripPaging({ vehicleId: selectedId ?? -1, limit: tripLimit + PAGE_SIZE.trips }),
    [selectedId, tripLimit],
  )
  const trips = useTripPage(selectedId, tripLimit)
  const tripRows = trips.data?.rows
  const tripTotal = trips.data?.total ?? 0
  const trip = useMemo(() => tripRows?.find((t) => t.id === route.trip) ?? null, [tripRows, route.trip])
  const detail = useTripDetail(trip?.id ?? null)

  // scrubbing / focus belong to one trip
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [focusedEvent, setFocusedEvent] = useState<{ event: TripEvent; nonce: number } | null>(null)
  const [hoveredVehicleId, setHoveredVehicleId] = useState<number | null>(null)
  useEffect(() => {
    setHoverIndex(null)
    setFocusedEvent(null)
  }, [route.trip, route.vehicle])

  // Land on the most recent trip; follow a deep link to an older one by loading further pages.
  useEffect(() => {
    if (selectedId === null || !tripRows || tripRows.length === 0) return
    if (route.trip !== null && tripRows.some((t) => t.id === route.trip)) return
    if (route.trip !== null && tripRows.length < tripTotal) {
      growTrips()
      return
    }
    navigate({ vehicle: selectedId, trip: tripRows[0].id }, { replace: true })
  }, [selectedId, route.trip, tripRows, tripTotal, growTrips, navigate])

  const selectVehicle = useCallback((id: number) => navigate({ vehicle: id, trip: null }), [navigate])
  const close = useCallback(() => navigate({ vehicle: null, trip: null }), [navigate])

  const onFilter = useCallback((f: VehicleFilter) => {
    setFilter(f)
    setLimit(PAGE_SIZE.vehicles)
  }, [])
  const onSearch = useCallback((s: string) => {
    setSearch(s)
    setLimit(PAGE_SIZE.vehicles)
  }, [])

  const acknowledge = useCallback(
    async (alertId: number) => {
      try {
        const changed = await acknowledgeAlert(alertId)
        invalidate()
        if (!changed) return toast({ message: 'That alert was already handled.' })
        toast({
          message: 'Alert acknowledged',
          action: {
            label: 'Undo',
            onClick: () => {
              unacknowledgeAlert(alertId)
                .then(invalidate)
                .catch((e: Error) => toast({ message: `Couldn’t undo: ${e.message}`, tone: 'error' }))
            },
          },
        })
      } catch (e) {
        toast({ message: `Couldn’t acknowledge: ${e instanceof Error ? e.message : 'unknown error'}`, tone: 'error' })
        throw e
      }
    },
    [toast],
  )

  // keyboard shortcuts (ignored while typing)
  const rows = page.data?.rows
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape') {
        if (selectedId !== null) close()
        return
      }
      if (isTypingTarget(e.target)) return
      if (e.key === '/') {
        e.preventDefault()
        setTab('vehicles')
        requestAnimationFrame(() => searchRef.current?.focus())
      } else if (e.key === '1') setTab('vehicles')
      else if (e.key === '2') setTab('alerts')
      else if ((e.key === 'j' || e.key === 'k') && rows && rows.length > 0) {
        const at = rows.findIndex((v) => v.id === selectedId)
        const next = e.key === 'j' ? Math.min(rows.length - 1, at + 1) : Math.max(0, at === -1 ? 0 : at - 1)
        if (rows[next].id !== selectedId) selectVehicle(rows[next].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rows, selectedId, close, selectVehicle])

  const insets = useMemo(() => (desktop ? { left: LIST_INSET, right: selectedId !== null ? DETAIL_INSET : 0 } : { left: 0, right: 0 }), [desktop, selectedId])

  const email = session.user.email ?? 'account'
  const live = snapshot.updatedAt !== null && !snapshot.error

  return (
    <div className={`app ${selectedId !== null ? 'has-detail' : ''}`}>
      <div className="map-layer">
        <FleetMap
          fleet={fleet}
          selectedId={selectedId}
          speedLimit={vehicle.data?.speed_limit_kph ?? 60}
          trip={trip}
          points={trip ? (detail.data?.points ?? NO_POINTS) : NO_POINTS}
          events={trip ? (detail.data?.events ?? NO_EVENTS) : NO_EVENTS}
          hoverIndex={hoverIndex}
          hoveredVehicleId={hoveredVehicleId}
          focusedEvent={focusedEvent}
          insets={insets}
          onSelectVehicle={selectVehicle}
        />
      </div>

      <aside className="card card-list" aria-label="Fleet">
        <header className="card-head">
          <div className="brand">
            <LogoMark size={26} />
            Fleetwatch
          </div>
          <div className="head-right">
            <span className="sync" title="The fleet refreshes automatically">
              <span className={`sync-dot ${snapshot.error ? 'bad' : live ? 'live' : ''}`} />
              {snapshot.error ? 'Offline' : snapshot.updatedAt ? `Live · ${timeAgo(new Date(snapshot.updatedAt).toISOString(), now)}` : 'Connecting…'}
            </span>
            <AccountMenu email={email} onSignOut={() => supabase.auth.signOut()} />
          </div>
        </header>
        {snapshot.error && !snapshot.data && <div className="banner banner-error">Couldn’t load the fleet: {snapshot.error}</div>}
        <FleetPanel
          snapshot={fleet}
          page={page}
          filter={filter}
          search={search}
          selectedId={selectedId}
          tab={tab}
          searchRef={searchRef}
          onTab={setTab}
          onFilter={onFilter}
          onSearch={onSearch}
          onMore={() => setLimit((n) => n + PAGE_SIZE.vehicles)}
          onSelect={selectVehicle}
          onHover={setHoveredVehicleId}
          onAcknowledge={acknowledge}
        />
      </aside>

      {selectedId !== null && (
        <aside className="card card-detail">
          {vehicle.data ? (
            <VehicleDetail
              key={vehicle.data.id}
              vehicle={vehicle.data}
              trips={trips}
              selectedTripId={trip?.id ?? null}
              detail={detail}
              hoverIndex={hoverIndex}
              onHover={setHoverIndex}
              onSelectTrip={(id) => navigate({ vehicle: selectedId, trip: id })}
              onMoreTrips={growTrips}
              onFocusEvent={(event) => setFocusedEvent({ event, nonce: Date.now() })}
              onAcknowledge={acknowledge}
              onClose={close}
            />
          ) : (
            <div className="detail-state">
              <button className="icon-btn detail-close" onClick={close} aria-label="Close vehicle details">
                <Icon name="close" size={18} />
              </button>
              {vehicle.loading ? (
                <div aria-busy="true" className="detail-skeleton">
                  <div className="skeleton skeleton-head" />
                  <div className="skeleton skeleton-tall" />
                  <div className="skeleton skeleton-tall" />
                </div>
              ) : (
                <div className="empty">
                  <Illustration kind={vehicle.error ? 'error' : 'search'} />
                  <b>{vehicle.error ? 'Couldn’t load this vehicle' : 'Vehicle not found'}</b>
                  <span>{vehicle.error ?? 'It may have been removed, or the link is wrong.'}</span>
                </div>
              )}
            </div>
          )}
        </aside>
      )}
    </div>
  )
}
