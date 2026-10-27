export type VehicleStatus = 'moving' | 'idle' | 'stopped' | 'offline' | 'maintenance'
export type Severity = 'critical' | 'warning' | 'info'
export type EventKind = 'overspeed' | 'halt' | 'harsh_brake'

export interface Vehicle {
  id: number
  reg_number: string
  name: string
  kind: 'van' | 'truck' | 'car' | 'pickup'
  make_model: string
  driver_id: number | null
  driver_name: string | null
  driver_phone: string | null
  depot: string
  speed_limit_kph: number
  status: VehicleStatus
  ignition: boolean
  last_lat: number
  last_lng: number
  last_heading: number
  last_speed_kph: number
  last_seen_at: string
  status_since: string
  fuel_pct: number
  battery_v: number
  odometer_km: number
  next_service_km: number
  trips_24h: number
  distance_24h_km: number
  overspeed_24h: number
  open_alerts: number
  top_alert_severity: Severity | null
  top_alert_title: string | null
}

/** The slim per-vehicle record behind the map and the header counts (one cheap query for the whole fleet). */
export type FleetPoint = Pick<
  Vehicle,
  | 'id' | 'name' | 'reg_number' | 'kind' | 'status' | 'status_since' | 'last_lat' | 'last_lng' | 'last_heading'
  | 'last_speed_kph' | 'open_alerts' | 'top_alert_severity' | 'distance_24h_km'
>

export type VehicleFilter = 'all' | 'attention' | 'moving' | 'idle' | 'parked' | 'offline'

export interface Page<T> {
  rows: T[]
  /** Total rows matching the query, across all pages. */
  total: number
}

export interface Trip {
  id: number
  vehicle_id: number
  driver_id: number | null
  started_at: string
  ended_at: string | null
  start_name: string
  end_name: string
  distance_km: number
  duration_s: number
  idle_s: number
  avg_speed_kph: number
  max_speed_kph: number
  halt_count: number
  overspeed_count: number
  harsh_brake_count: number
}

export interface TripPoint {
  seq: number
  recorded_at: string
  lat: number
  lng: number
  speed_kph: number
}

export interface TripEvent {
  id: number
  trip_id: number
  kind: EventKind
  occurred_at: string
  lat: number
  lng: number
  value: number
  duration_s: number
}

export interface Alert {
  id: number
  vehicle_id: number
  vehicle_name: string
  vehicle_reg: string
  kind: 'offline' | 'low_fuel' | 'low_battery' | 'service_due' | 'overspeed' | 'prolonged_idle'
  severity: Severity
  title: string
  detail: string | null
  raised_at: string
  acknowledged_at: string | null
}
