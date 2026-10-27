import {
  fetchAlertPage,
  fetchFleetSnapshot,
  fetchTripDetail,
  fetchTripPage,
  fetchVehicle,
  fetchVehiclePage,
} from '../lib/api'
import { normalizeQuery } from '../lib/sanitize'
import type { VehicleFilter } from '../lib/types'
import { usePolled } from './usePolled'

const REFRESH_MS = 20_000
export const PAGE_SIZE = { vehicles: 25, alerts: 10, trips: 8 } as const

/** Whole fleet, slim: feeds the map and the header counts. */
export const useFleetSnapshot = () => usePolled(fetchFleetSnapshot, 'snapshot', { intervalMs: REFRESH_MS })

/** One growing page of vehicles (filter + search run in the database). */
export function useVehiclePage(filter: VehicleFilter, search: string, limit: number) {
  const q = normalizeQuery(search)
  return usePolled(() => fetchVehiclePage({ filter, search: q, limit }), `vehicles|${filter}|${q}|${limit}`, {
    intervalMs: REFRESH_MS,
    group: 'vehicles',
  })
}

/** Full record for the selected vehicle. */
export const useVehicle = (id: number | null) =>
  usePolled(() => fetchVehicle(id as number), `vehicle|${id}`, { intervalMs: REFRESH_MS, enabled: id !== null })

export function useAlertPage(opts: { vehicleId?: number | null; acknowledged: boolean; limit: number; enabled?: boolean }) {
  const { vehicleId = null, acknowledged, limit, enabled = true } = opts
  return usePolled(
    () => fetchAlertPage({ vehicleId, acknowledged, limit }),
    `alerts|${vehicleId}|${acknowledged}|${limit}`,
    { intervalMs: REFRESH_MS, group: `alerts|${vehicleId}|${acknowledged}`, enabled },
  )
}

export const useTripPage = (vehicleId: number | null, limit: number) =>
  usePolled(() => fetchTripPage(vehicleId as number, limit), `trips|${vehicleId}|${limit}`, {
    group: `trips|${vehicleId}`,
    enabled: vehicleId !== null,
  })

// Trips are immutable once loaded; keep recent ones so flipping between trips is instant.
const detailCache = new Map<number, Awaited<ReturnType<typeof fetchTripDetail>>>()
const DETAIL_CACHE_MAX = 30

async function cachedTripDetail(id: number) {
  const hit = detailCache.get(id)
  if (hit) return hit
  const data = await fetchTripDetail(id)
  detailCache.set(id, data)
  if (detailCache.size > DETAIL_CACHE_MAX) detailCache.delete(detailCache.keys().next().value as number)
  return data
}

export const useTripDetail = (tripId: number | null) =>
  usePolled(() => cachedTripDetail(tripId as number), `trip|${tripId}`, { enabled: tripId !== null })
