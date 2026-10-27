import { containsPattern } from './sanitize'
import { supabase } from './supabase'
import type { Alert, FleetPoint, Page, Trip, TripEvent, TripPoint, Vehicle, VehicleFilter } from './types'

// All reads are plain PostgREST queries (bound parameters, never string-built SQL); the single write path
// is the acknowledge/undo RPC pair. Anything user-typed goes through ./sanitize first.

type Result<T> = PromiseLike<{ data: T | null; error: { message: string } | null; count?: number | null }>

async function rows<T>(query: Result<T[]>): Promise<T[]> {
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

async function page<T>(query: Result<T[]>): Promise<Page<T>> {
  const { data, error, count } = await query
  if (error) throw new Error(error.message)
  const list = data ?? []
  return { rows: list, total: count ?? list.length }
}

/** Hard ceiling for the "whole fleet" snapshot; beyond this the map should switch to viewport queries. */
export const SNAPSHOT_LIMIT = 1000
export const POINT_PAGE = 1000 // PostgREST's default max-rows

const SNAPSHOT_COLUMNS =
  'id,name,reg_number,kind,status,status_since,last_lat,last_lng,last_heading,last_speed_kph,open_alerts,top_alert_severity,distance_24h_km'

export const fetchFleetSnapshot = () =>
  rows<FleetPoint>(supabase.from('v_vehicles').select(SNAPSHOT_COLUMNS).order('id').limit(SNAPSHOT_LIMIT))

export interface VehicleQuery {
  filter: VehicleFilter
  search: string
  limit: number
}

export function fetchVehiclePage({ filter, search, limit }: VehicleQuery): Promise<Page<Vehicle>> {
  let q = supabase.from('v_vehicles').select('*', { count: 'exact' })
  switch (filter) {
    case 'attention':
      q = q.gt('open_alerts', 0)
      break
    case 'moving':
    case 'idle':
    case 'offline':
      q = q.eq('status', filter)
      break
    case 'parked':
      q = q.in('status', ['stopped', 'maintenance'])
      break
  }
  const pattern = containsPattern(search)
  if (pattern) q = q.ilike('search_text', pattern)
  return page<Vehicle>(q.order('sort_rank').order('id').range(0, Math.max(0, limit - 1)))
}

export async function fetchVehicle(id: number): Promise<Vehicle | null> {
  const list = await rows<Vehicle>(supabase.from('v_vehicles').select('*').eq('id', id).limit(1))
  return list[0] ?? null
}

export interface AlertQuery {
  vehicleId?: number | null
  acknowledged: boolean
  limit: number
}

export function fetchAlertPage({ vehicleId, acknowledged, limit }: AlertQuery): Promise<Page<Alert>> {
  let q = supabase.from('v_alerts').select('*', { count: 'exact' })
  q = acknowledged ? q.not('acknowledged_at', 'is', null) : q.is('acknowledged_at', null)
  if (vehicleId) q = q.eq('vehicle_id', vehicleId)
  q = acknowledged
    ? q.order('acknowledged_at', { ascending: false })
    : q.order('severity_rank').order('raised_at', { ascending: false })
  return page<Alert>(q.order('id').range(0, Math.max(0, limit - 1)))
}

export const fetchTripPage = (vehicleId: number, limit: number) =>
  page<Trip>(
    supabase
      .from('v_trips')
      .select('*', { count: 'exact' })
      .eq('vehicle_id', vehicleId)
      .order('started_at', { ascending: false })
      .order('id', { ascending: false })
      .range(0, Math.max(0, limit - 1)),
  )

export async function fetchTripDetail(tripId: number): Promise<{ points: TripPoint[]; events: TripEvent[] }> {
  // Walk the points in server-sized pages so a long trip can never be silently truncated.
  const points: TripPoint[] = []
  for (let from = 0; ; from += POINT_PAGE) {
    const batch = await rows<TripPoint>(
      supabase
        .from('v_trip_points')
        .select('seq,recorded_at,lat,lng,speed_kph')
        .eq('trip_id', tripId)
        .order('seq')
        .range(from, from + POINT_PAGE - 1),
    )
    points.push(...batch)
    if (batch.length < POINT_PAGE) break
  }
  const events = await rows<TripEvent>(
    supabase.from('v_trip_events').select('*').eq('trip_id', tripId).order('occurred_at').limit(500),
  )
  return { points, events }
}

async function rpcBool(fn: 'acknowledge_alert' | 'unacknowledge_alert', alertId: number): Promise<boolean> {
  if (!Number.isSafeInteger(alertId) || alertId <= 0) throw new Error('Invalid alert id')
  const { data, error } = await supabase.rpc(fn, { p_alert_id: alertId })
  if (error) throw new Error(error.message)
  return data === true
}

export const acknowledgeAlert = (id: number) => rpcBool('acknowledge_alert', id)
export const unacknowledgeAlert = (id: number) => rpcBool('unacknowledge_alert', id)
