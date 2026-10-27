// Generates supabase/seed.sql: a believable Bengaluru fleet with four days of trips.
//
//   node scripts/generate-seed.mjs
//
// Routes follow real roads (fetched once from the public OSRM demo server, then cached in
// scripts/.osrm-cache.json). Driving along each route is simulated second by second
// (acceleration, signals, congestion, a few aggressive drivers), then sampled to GPS pings and
// summarised into the trip statistics and events that the app displays. Output is deterministic.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const CACHE_FILE = join(here, '.osrm-cache.json')
const OUT_FILE = join(here, '..', 'supabase', 'seed.sql')

// ---------------------------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------------------------

const PLACES = {
  'Whitefield Hub':           [12.9698, 77.7500],
  'Peenya Hub':               [13.0285, 77.5197],
  'Electronic City Hub':      [12.8456, 77.6603],
  'Koramangala 5th Block':    [12.9352, 77.6245],
  'Indiranagar 100ft Rd':     [12.9784, 77.6408],
  'Hebbal Junction':          [13.0358, 77.5970],
  'Marathahalli Bridge':      [12.9591, 77.6974],
  'HSR Layout Sector 2':      [12.9116, 77.6474],
  'Jayanagar 4th Block':      [12.9250, 77.5938],
  'Yeshwanthpur Market':      [13.0238, 77.5498],
  'Manyata Tech Park':        [13.0476, 77.6209],
  'Arekere, Bannerghatta Rd': [12.8885, 77.5970],
  'KR Puram':                 [13.0067, 77.6957],
  'Rajajinagar':              [12.9916, 77.5520],
  'Banashankari':             [12.9255, 77.5468],
  'MG Road':                  [12.9756, 77.6068],
  'Bommanahalli':             [12.9081, 77.6238],
  'Bellandur':                [12.9260, 77.6762],
}
const DEPOTS = ['Whitefield Hub', 'Peenya Hub', 'Electronic City Hub']
const SERVICE_CENTRE = { name: 'Electronic City Service Centre', pos: [12.8486, 77.6702] }

const DRIVERS = [
  { name: 'Ravi Kumar',        phone: '+91 98450 11201', licence: 'KA0120180034211', aggr: 1.04 },
  { name: 'Suresh Babu',       phone: '+91 98450 11202', licence: 'KA0520170019876', aggr: 0.95 },
  { name: 'Imran Pasha',       phone: '+91 98450 11203', licence: 'KA0320190045532', aggr: 1.22 },
  { name: 'Manjunath Gowda',   phone: '+91 98450 11204', licence: 'KA0120150088713', aggr: 0.92 },
  { name: 'Venkatesh Reddy',   phone: '+91 98450 11205', licence: 'KA5120200012264', aggr: 1.0 },
  { name: 'Anil Shetty',       phone: '+91 98450 11206', licence: 'KA0120160067490', aggr: 1.17 },
  { name: 'Priya Nair',        phone: '+91 98450 11207', licence: 'KA0220210031158', aggr: 0.95 },
  { name: 'Ganesh Naik',       phone: '+91 98450 11208', licence: 'KA0520140052907', aggr: 1.0 },
  { name: 'Mohammed Irfan',    phone: '+91 98450 11209', licence: 'KA0420190073345', aggr: 1.0 },
  { name: 'Ramesh Kulkarni',   phone: '+91 98450 11210', licence: 'KA0120130029681', aggr: 1.05 },
  { name: 'Deepak Joshi',      phone: '+91 98450 11211', licence: 'KA5320220008419', aggr: 0.97 },
  { name: 'Harish Rao',        phone: '+91 98450 11212', licence: 'KA0120120091126', aggr: 0.92 },
]

// role = where the vehicle is "right now": moving | idle | stopped | offline | maintenance
const VEHICLES = [
  { reg: 'KA-01-AB-4821', name: 'Van 01',    kind: 'van',    model: 'Tata Ace Gold',           depot: 0, role: 'moving',      fuel: 62, batt: 12.6, odo: 48210, svc: 50000 },
  { reg: 'KA-01-AC-1173', name: 'Van 02',    kind: 'van',    model: 'Maruti Eeco Cargo',       depot: 0, role: 'stopped',     fuel: 48, batt: 12.7, odo: 31870, svc: 40000 },
  { reg: 'KA-05-MH-3392', name: 'Van 03',    kind: 'van',    model: 'Tata Ace Gold',           depot: 1, role: 'idle',        fuel: 12, batt: 12.4, odo: 22540, svc: 30000 },
  { reg: 'KA-03-AD-7706', name: 'Truck 01',  kind: 'truck',  model: 'Eicher Pro 2049',         depot: 1, role: 'moving',      fuel: 14, batt: 12.5, odo: 77690, svc: 80000 },
  { reg: 'KA-51-AF-2245', name: 'Pickup 01', kind: 'pickup', model: 'Mahindra Bolero Pik-Up',  depot: 2, role: 'stopped',     fuel: 71, batt: 11.6, odo: 54120, svc: 60000 },
  { reg: 'KA-01-AG-9018', name: 'Van 04',    kind: 'van',    model: 'Mahindra Supro',          depot: 2, role: 'moving',      fuel: 55, batt: 12.8, odo: 15380, svc: 20000 },
  { reg: 'KA-02-AH-5530', name: 'Car 01',    kind: 'car',    model: 'Maruti Dzire',            depot: 0, role: 'stopped',     fuel: 83, batt: 12.9, odo: 39450, svc: 45000 },
  { reg: 'KA-05-AJ-6674', name: 'Truck 02',  kind: 'truck',  model: 'Tata 407',                depot: 1, role: 'offline',     fuel: 36, batt: 12.3, odo: 91240, svc: 95000 },
  { reg: 'KA-04-AK-1289', name: 'Van 05',    kind: 'van',    model: 'Tata Ace Gold',           depot: 2, role: 'idle',        fuel: 58, batt: 12.6, odo: 29870, svc: 30000 },
  { reg: 'KA-01-AL-8451', name: 'Pickup 02', kind: 'pickup', model: 'Tata Yodha',              depot: 1, role: 'stopped',     fuel: 44, batt: 12.7, odo: 67310, svc: 70000 },
  { reg: 'KA-53-AM-3067', name: 'Van 06',    kind: 'van',    model: 'Mahindra Jeeto',          depot: 0, role: 'moving',      fuel: 67, batt: 12.5, odo: 12940, svc: 20000 },
  { reg: 'KA-01-AN-2590', name: 'Truck 03',  kind: 'truck',  model: 'Ashok Leyland Dost',      depot: 2, role: 'maintenance', fuel: 40, batt: 12.5, odo: 103880, svc: 100000 },
]
const LIMITS = { van: 60, truck: 50, pickup: 60, car: 70 }
const SPEED_FACTOR = { van: 0.95, truck: 0.8, pickup: 0.95, car: 1.05 }

const HISTORY_DAYS = 4          // today + 3 previous days
const NOW_TOD = 14 * 3600 + 20 * 60  // the fictional "now" is 14:20 local on day 0
const SAMPLE_EVERY_S = 20

// ---------------------------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = mulberry32(20261027)
const rand = (lo, hi) => lo + rng() * (hi - lo)
const pick = (arr) => arr[Math.floor(rng() * arr.length)]
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))
const r5 = (x) => Math.round(x * 1e5) / 1e5
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function haversine([lat1, lng1], [lat2, lng2]) {
  const R = 6371000, toR = Math.PI / 180
  const dLat = (lat2 - lat1) * toR, dLng = (lng2 - lng1) * toR
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
function bearing([lat1, lng1], [lat2, lng2]) {
  const toR = Math.PI / 180
  const y = Math.sin((lng2 - lng1) * toR) * Math.cos(lat2 * toR)
  const x = Math.cos(lat1 * toR) * Math.sin(lat2 * toR) - Math.sin(lat1 * toR) * Math.cos(lat2 * toR) * Math.cos((lng2 - lng1) * toR)
  return Math.round(((Math.atan2(y, x) / toR) + 360) % 360)
}
const sqlStr = (s) => `'${String(s).replaceAll("'", "''")}'`
// Offsets are seconds relative to the seed instant (negative = in the past).
const ts = (offsetS) => `now() - ${Math.round(-offsetS)} * interval '1 second'`
const fmtHm = (sec) => `${String(Math.floor(sec / 3600)).padStart(2, '0')}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}`

// ---------------------------------------------------------------------------------------------
// Road routes (OSRM)
// ---------------------------------------------------------------------------------------------

const cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {}
let cacheDirty = false

async function fetchRoute(a, b) {
  const [A, B] = a < b ? [a, b] : [b, a]
  const key = `${A}|${B}`
  if (!cache[key]) {
    const [la, lo] = PLACES[A], [lb, lob] = PLACES[B]
    const url = `https://router.project-osrm.org/route/v1/driving/${lo},${la};${lob},${lb}?overview=full&geometries=geojson&annotations=speed,distance`
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(url)
        const json = await res.json()
        if (json.code !== 'Ok') throw new Error(json.code)
        const r = json.routes[0]
        cache[key] = {
          coords: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
          speed: r.legs[0].annotation.speed,
          dist: r.legs[0].annotation.distance,
        }
        break
      } catch (e) {
        if (attempt >= 4) throw new Error(`OSRM failed for ${key}: ${e.message}`)
        await sleep(2500)
      }
    }
    cacheDirty = true
    console.log(`  routed ${key}`)
    await sleep(1100)
  }
  const raw = cache[key]
  const forward = a === A
  const coords = forward ? raw.coords : [...raw.coords].reverse()
  const speed = forward ? raw.speed : [...raw.speed].reverse()
  const dist = forward ? raw.dist : [...raw.dist].reverse()
  return buildRoute(coords, speed, dist)
}

function buildRoute(coords, speed, dist) {
  // drop repeated points
  const pts = coords.filter((p, i) => i === 0 || p[0] !== coords[i - 1][0] || p[1] !== coords[i - 1][1])
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + haversine(pts[i - 1], pts[i]))
  const annCum = [0]
  for (let i = 0; i < dist.length; i++) annCum.push(annCum[i] + dist[i])
  return { pts, cum, total: cum[cum.length - 1], speed, annCum, annTotal: annCum[annCum.length - 1] }
}

function posAt(route, s) {
  const { pts, cum } = route
  if (s <= 0) return pts[0]
  if (s >= route.total) return pts[pts.length - 1]
  let lo = 0, hi = cum.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (cum[mid] <= s) lo = mid
    else hi = mid
  }
  const f = (s - cum[lo]) / (cum[hi] - cum[lo] || 1)
  return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f]
}
function freeFlowAt(route, s) {
  const target = (s / route.total) * route.annTotal
  let lo = 0, hi = route.annCum.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (route.annCum[mid] <= target) lo = mid
    else hi = mid
  }
  return route.speed[Math.min(lo, route.speed.length - 1)] ?? 10
}

// ---------------------------------------------------------------------------------------------
// Driving simulation (1 s steps)
// ---------------------------------------------------------------------------------------------

function simulateLeg(route, vehicle, driver, cutAtS = Infinity) {
  const D = route.total
  const limitKph = LIMITS[vehicle.kind]
  const A_ACC = 1.6, A_BRAKE = 2.6, A_COMFORT = 1.8
  const congestion = rand(0.62, 0.95)
  const phase = rand(0, 6.28)

  const stops = []
  for (let p = rand(300, 900); p < D - 300; p += rand(500, 1800)) {
    if (rng() < 0.55) stops.push({ s: p, hold: rng() < 0.3 ? rand(60, 170) : rand(12, 45) })
  }
  let hazardAt = rng() < (driver.aggr > 1.1 ? 0.5 : 0.07) ? D * rand(0.2, 0.8) : null
  let hazardTicks = 0

  const startIdle = Math.round(rand(20, 80))
  const rec = []        // per-second: [s, v]
  let t = 0, s = 0, v = 0, stopIdx = 0, hold = 0
  const harshAt = []    // second indices where decel >= 3.3 m/s^2

  while (t < 3 * 3600 && t < cutAtS) {
    let vPrev = v
    if (t < startIdle) {
      v = 0
    } else if (hold > 0) {
      v = 0
      hold--
    } else {
      const ff = Math.min(freeFlowAt(route, s), 24) * SPEED_FACTOR[vehicle.kind]
      let target = ff * (congestion + 0.1 * Math.sin(t / 90 + phase)) * driver.aggr
      const next = stops[stopIdx]
      const toStop = next ? next.s - s : Infinity
      const toEnd = D - s
      const brakeTo = (d) => Math.sqrt(Math.max(0, 2 * A_COMFORT * d))
      target = Math.min(target, brakeTo(Math.min(toStop, toEnd)) + 0.8)
      target = Math.min(target, 27)
      if (hazardAt !== null && s >= hazardAt && v > 8) { hazardTicks = 3; hazardAt = null } // >8 m/s ≈ 30 km/h
      let aBrake = A_BRAKE
      if (hazardTicks > 0) { target = v * 0.2; aBrake = 4.6; hazardTicks-- }
      v = clamp(v + clamp(target - v, -aBrake, A_ACC), 0, 27)
      s = Math.min(D, s + (v + vPrev) / 2)
      if (next && next.s - s < 1.5 && v < 1.2) { s = next.s; v = 0; hold = Math.round(next.hold); stopIdx++ }
      // one event per braking episode, and only from a real driving speed
      if (vPrev - v >= 3.3 && vPrev > 6 && (harshAt.length === 0 || t - harshAt[harshAt.length - 1] > 8)) harshAt.push(t)
    }
    rec.push([s, v])
    t++
    if (D - s < 1.5) { rec[rec.length - 1][1] = 0; break }
  }
  const finished = D - s < 3
  return summarise(route, vehicle, rec, harshAt, limitKph, finished)
}

function summarise(route, vehicle, rec, harshAt, limitKph, finished) {
  const n = rec.length
  const kph = rec.map(([, v]) => v * 3.6)

  // GPS pings
  const points = []
  for (let i = 0; i < n; i += SAMPLE_EVERY_S) points.push(i)
  if (points[points.length - 1] !== n - 1) points.push(n - 1)
  const pings = points.map((i) => {
    const [lat, lng] = posAt(route, rec[i][0])
    return { dt: i, lat: r5(lat), lng: r5(lng), kph: Math.round(kph[i]) }
  })

  const events = []
  // overspeed: contiguous run above limit+2 for >= 8 s
  const thresh = limitKph + 2
  for (let i = 0; i < n;) {
    if (kph[i] > thresh) {
      let j = i, peak = i
      while (j < n && kph[j] > thresh) { if (kph[j] > kph[peak]) peak = j; j++ }
      if (j - i >= 8) {
        const [lat, lng] = posAt(route, rec[peak][0])
        events.push({ kind: 'overspeed', dt: peak, lat: r5(lat), lng: r5(lng), value: Math.round(kph[peak]), dur: j - i })
      }
      i = j
    } else i++
  }
  // halts: stationary >= 60 s after the initial warm-up is over, and not at the very end
  let idle = 0, halts = 0
  for (let i = 0; i < n;) {
    if (kph[i] < 1) {
      let j = i
      while (j < n && kph[j] < 1) j++
      idle += j - i
      const atStart = i === 0
      const atEnd = j === n && finished
      if (!atStart && !atEnd && j - i >= 60) {
        const [lat, lng] = posAt(route, rec[i][0])
        events.push({ kind: 'halt', dt: i, lat: r5(lat), lng: r5(lng), value: j - i, dur: j - i })
        halts++
      }
      i = j
    } else i++
  }
  for (const i of harshAt) {
    const [lat, lng] = posAt(route, rec[i][0])
    events.push({ kind: 'harsh_brake', dt: i, lat: r5(lat), lng: r5(lng), value: Math.round(kph[Math.max(0, i - 1)]), dur: 0 })
  }
  events.sort((a, b) => a.dt - b.dt)

  const distance = rec[n - 1][0] / 1000
  return {
    pings, events, finished,
    stats: {
      distance_km: Math.round(distance * 100) / 100,
      duration_s: n,
      idle_s: idle,
      avg_speed_kph: Math.round((distance / (n / 3600)) * 10) / 10,
      max_speed_kph: Math.round(Math.max(...kph) * 10) / 10,
      halt_count: halts,
      overspeed_count: events.filter((e) => e.kind === 'overspeed').length,
      harsh_brake_count: events.filter((e) => e.kind === 'harsh_brake').length,
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------------------------

const depotName = (v) => DEPOTS[v.depot]
function nearbyStops(depot) {
  return Object.keys(PLACES)
    .filter((p) => !DEPOTS.includes(p))
    .sort((a, b) => haversine(PLACES[depot], PLACES[a]) - haversine(PLACES[depot], PLACES[b]))
    .slice(0, 9)
}
function randomStops(v, count) {
  const pool = nearbyStops(depotName(v))
  const out = []
  while (out.length < count) {
    const p = pick(pool)
    if (p !== out[out.length - 1]) out.push(p)
  }
  return out
}

/** Absolute offset (seconds relative to now) for a given day and time-of-day. */
const at = (day, tod) => tod - NOW_TOD - day * 86400

async function legTrip(v, driver, from, to, startOffset, cutAtS) {
  const route = await fetchRoute(from, to)
  const sim = simulateLeg(route, v, driver, cutAtS)
  return { vehicle: v, driver, from, to, startOffset, route, ...sim }
}

/** Plan a chain of legs for one vehicle-day, laid out forward from a start time. */
async function forwardChain(v, driver, day, startTod, places) {
  const trips = []
  let cursor = startTod
  for (let i = 0; i < places.length - 1; i++) {
    const trip = await legTrip(v, driver, places[i], places[i + 1], at(day, cursor))
    trips.push(trip)
    cursor += trip.stats.duration_s + Math.round(rand(12, 38) * 60)
  }
  return trips
}

/** Plan a chain that must end (or be cut) at a given offset: laid out backwards from there. */
async function backwardChain(v, driver, places, endOffset, partialElapsed) {
  // places = [p0, p1, ..., pk]; the last leg is either complete ending at endOffset, or (if partialElapsed)
  // in progress and started at endOffset - partialElapsed
  const legs = []
  let nextStart
  for (let i = places.length - 2; i >= 0; i--) {
    let trip
    if (i === places.length - 2) {
      if (partialElapsed) {
        const start = endOffset - partialElapsed
        trip = await legTrip(v, driver, places[i], places[i + 1], start, partialElapsed)
        if (trip.finished) return null // route too short to still be in progress
      } else {
        const dry = await legTrip(v, driver, places[i], places[i + 1], 0)
        trip = { ...dry, startOffset: endOffset - dry.stats.duration_s }
      }
    } else {
      const dry = await legTrip(v, driver, places[i], places[i + 1], 0)
      const end = nextStart - Math.round(rand(12, 35) * 60)
      trip = { ...dry, startOffset: end - dry.stats.duration_s }
    }
    nextStart = trip.startOffset
    legs.unshift(trip)
  }
  return legs
}

async function planVehicle(v, idx) {
  const driver = DRIVERS[idx]
  const depot = depotName(v)
  const trips = []

  // previous full days (oldest first)
  for (let day = HISTORY_DAYS - 1; day >= 1; day--) {
    if (v.role === 'maintenance' && day === 1) continue // in the workshop since yesterday
    const legs = rng() < 0.45 ? 3 : 2
    const stops = randomStops(v, legs)
    const places = [depot, ...stops, depot]
    trips.push(...(await forwardChain(v, driver, day, Math.round(rand(7.2, 9.4) * 3600), places)))
  }

  // today
  let plan = {}
  if (v.role === 'moving') {
    const u = Math.round(rand(6, 14) * 60)
    for (let attempt = 0; attempt < 12; attempt++) {
      const places = [depot, ...randomStops(v, 3)]
      const legs = await backwardChain(v, driver, places, 0, u)
      if (legs) { trips.push(...legs); plan = { last: legs[legs.length - 1], live: true }; break }
    }
  } else if (v.role === 'idle') {
    const idleMin = v.name === 'Van 03' ? 28 : 12
    const places = [depot, ...randomStops(v, 2)]
    const legs = await backwardChain(v, driver, places, -idleMin * 60, 0)
    trips.push(...legs)
    plan = { last: legs[legs.length - 1], idleMin }
  } else if (v.role === 'stopped') {
    const places = [depot, ...randomStops(v, 2), depot]
    const legs = await backwardChain(v, driver, places, at(0, Math.round(rand(11.6, 13.2) * 3600)), 0)
    trips.push(...legs)
    plan = { last: legs[legs.length - 1] }
  } else if (v.role === 'offline') {
    const lostAt = -(5 * 3600 + 40 * 60)
    const u = Math.round(rand(11, 14) * 60)
    for (let attempt = 0; attempt < 12; attempt++) {
      const places = [depot, ...randomStops(v, 2)]
      const legs = await backwardChain(v, driver, places, lostAt, u)
      if (legs) { trips.push(...legs); plan = { last: legs[legs.length - 1], lostAt }; break }
    }
  }
  return { driver, trips, plan }
}

// ---------------------------------------------------------------------------------------------
// Assemble + write SQL
// ---------------------------------------------------------------------------------------------

async function main() {
  console.log('Planning routes (cached after the first run)…')
  const planned = []
  for (let i = 0; i < VEHICLES.length; i++) planned.push(await planVehicle(VEHICLES[i], i))
  if (cacheDirty) writeFileSync(CACHE_FILE, JSON.stringify(cache))

  // Flatten trips, ids in chronological order per vehicle
  const trips = []
  planned.forEach((p, vi) => {
    for (const t of p.trips) trips.push({ ...t, vehicleId: vi + 1, driverId: vi + 1 })
  })

  // Vehicle live state
  const vehicleRows = VEHICLES.map((v, i) => {
    const { plan, trips: vt } = planned[i]
    const lastTrip = vt[vt.length - 1]
    const lastPing = lastTrip?.pings[lastTrip.pings.length - 1]
    const prevPing = lastTrip?.pings[lastTrip.pings.length - 2]
    const heading = lastPing && prevPing ? bearing([prevPing.lat, prevPing.lng], [lastPing.lat, lastPing.lng]) : 0
    const row = { ...v, i, driverId: i + 1, limit: LIMITS[v.kind] }
    switch (v.role) {
      case 'moving':
        lastPing.kph = Math.max(lastPing.kph, 14) // a "moving" vehicle shouldn't be caught at a red light
        Object.assign(row, { status: 'moving', ignition: true, lat: lastPing.lat, lng: lastPing.lng, heading, speed: lastPing.kph, seen: -4, since: plan.last.startOffset })
        break
      case 'idle':
        Object.assign(row, { status: 'idle', ignition: true, lat: lastPing.lat, lng: lastPing.lng, heading, speed: 0, seen: -18, since: -plan.idleMin * 60 })
        break
      case 'stopped': {
        const end = plan.last.startOffset + plan.last.stats.duration_s
        Object.assign(row, { status: 'stopped', ignition: false, lat: lastPing.lat, lng: lastPing.lng, heading, speed: 0, seen: end + Math.round(rand(2, 9) * 60), since: end })
        break
      }
      case 'offline':
        Object.assign(row, { status: 'offline', ignition: true, lat: lastPing.lat, lng: lastPing.lng, heading, speed: lastPing.kph, seen: plan.lostAt, since: plan.lostAt })
        break
      case 'maintenance': {
        const [lat, lng] = SERVICE_CENTRE.pos
        Object.assign(row, { status: 'maintenance', ignition: false, lat, lng, heading: 90, speed: 0, seen: -9 * 60, since: at(1, 10 * 3600) })
        break
      }
    }
    return row
  })

  // Alerts ------------------------------------------------------------------------------------
  const alerts = []
  const add = (a) => alerts.push(a)
  VEHICLES.forEach((v, i) => {
    const row = vehicleRows[i]
    const vid = i + 1
    if (v.role === 'offline') {
      const lastTrip = planned[i].trips.at(-1)
      add({ vid, kind: 'offline', severity: 'critical', title: 'Lost GPS signal mid-trip',
        detail: `Last ping was on the way from ${lastTrip.from} to ${lastTrip.to}. Check with the driver.`, raised: row.seen + 30 * 60 })
    }
    if (v.fuel < 15) add({ vid, kind: 'low_fuel', severity: 'warning', title: `Low fuel — ${v.fuel}%`, detail: 'Refuel before the next dispatch.', raised: -(rand(1, 3) * 3600) })
    if (v.batt < 11.9) add({ vid, kind: 'low_battery', severity: 'warning', title: `Battery voltage low — ${v.batt.toFixed(1)} V`, detail: 'Below 11.9 V while parked; risk of a no-start.', raised: -(rand(2, 5) * 3600) })
    if (v.svc - v.odo <= 250 && v.svc - v.odo > 0) add({ vid, kind: 'service_due', severity: 'info', title: `Service due in ${v.svc - v.odo} km`, detail: `Next service at ${v.svc.toLocaleString('en-IN')} km.`, raised: -(26 * 3600) })
    if (v.role === 'idle' && row.since < -20 * 60) add({ vid, kind: 'prolonged_idle', severity: 'warning', title: 'Idling with ignition on', detail: 'Stationary with the engine running. Fuel is being burnt for no distance.', raised: row.since + 15 * 60 })
    // overspeed in the last 24h (day 0 trips)
    const recent = planned[i].trips.filter((t) => t.startOffset > -24 * 3600)
    const ev = recent.flatMap((t) => t.events.filter((e) => e.kind === 'overspeed'))
    if (ev.length >= 3) {
      const peak = Math.max(...ev.map((e) => e.value))
      const lastEv = recent.flatMap((t) => t.events.filter((e) => e.kind === 'overspeed').map((e) => t.startOffset + e.dt)).sort((a, b) => a - b).at(-1)
      add({ vid, kind: 'overspeed', severity: 'warning', title: `${ev.length} overspeed events in 24 h`, detail: `Peak ${peak} km/h against a ${LIMITS[v.kind]} km/h limit.`, raised: lastEv })
    }
  })
  // Already-acknowledged history
  add({ vid: 2, kind: 'low_fuel', severity: 'warning', title: 'Low fuel — 13%', detail: 'Refuel before the next dispatch.', raised: -(2 * 86400 + 3600 * 3), ack: -(2 * 86400 + 3600) })
  add({ vid: 7, kind: 'prolonged_idle', severity: 'warning', title: 'Idling with ignition on', detail: 'Stationary with the engine running.', raised: -(86400 + 5 * 3600), ack: -(86400 + 4 * 3600) })
  add({ vid: 4, kind: 'overspeed', severity: 'warning', title: '3 overspeed events in 24 h', detail: 'Peak 61 km/h against a 50 km/h limit.', raised: -(2 * 86400 + 6 * 3600), ack: -(2 * 86400 + 5 * 3600) })

  // SQL ---------------------------------------------------------------------------------------
  const out = []
  out.push('-- GENERATED by scripts/generate-seed.mjs — do not edit by hand.')
  out.push('-- Safe to re-run: it wipes and reloads the fleet tables.')
  out.push('begin;')
  out.push('truncate public.alerts, public.trip_events, public.trip_points, public.trips, public.vehicles, public.drivers, public.demo_clock restart identity cascade;')
  out.push('insert into public.demo_clock (anchor) values (now());')

  out.push('insert into public.drivers (id, full_name, phone, licence_no) overriding system value values')
  out.push(DRIVERS.map((d, i) => `  (${i + 1}, ${sqlStr(d.name)}, ${sqlStr(d.phone)}, ${sqlStr(d.licence)})`).join(',\n') + ';')

  out.push('insert into public.vehicles (id, reg_number, name, kind, make_model, driver_id, depot, speed_limit_kph, status, ignition, last_lat, last_lng, last_heading, last_speed_kph, last_seen_at, status_since, fuel_pct, battery_v, odometer_km, next_service_km) overriding system value values')
  out.push(vehicleRows.map((r, i) =>
    `  (${i + 1}, ${sqlStr(r.reg)}, ${sqlStr(r.name)}, ${sqlStr(r.kind)}, ${sqlStr(r.model)}, ${r.driverId}, ${sqlStr(DEPOTS[r.depot])}, ${r.limit}, ${sqlStr(r.status)}, ${r.ignition}, ${r.lat}, ${r.lng}, ${r.heading}, ${Math.round(r.speed)}, ${ts(r.seen)}, ${ts(r.since)}, ${r.fuel}, ${r.batt}, ${r.odo}, ${r.svc})`
  ).join(',\n') + ';')

  // trips (ids assigned in vehicle order, then chronological)
  trips.forEach((t, i) => { t.id = i + 1 })
  out.push('insert into public.trips (id, vehicle_id, driver_id, started_at, ended_at, start_name, end_name, distance_km, duration_s, idle_s, avg_speed_kph, max_speed_kph, halt_count, overspeed_count, harsh_brake_count) overriding system value values')
  out.push(trips.map((t) => {
    const open = !t.finished
    const s = t.stats
    return `  (${t.id}, ${t.vehicleId}, ${t.driverId}, ${ts(t.startOffset)}, ${open ? 'null' : ts(t.startOffset + s.duration_s)}, ${sqlStr(t.from)}, ${sqlStr(t.to)}, ${s.distance_km}, ${s.duration_s}, ${s.idle_s}, ${s.avg_speed_kph}, ${s.max_speed_kph}, ${s.halt_count}, ${s.overspeed_count}, ${s.harsh_brake_count})`
  }).join(',\n') + ';')
  out.push(`select setval(pg_get_serial_sequence('public.trips', 'id'), ${trips.length});`)

  // trip points in chunks
  const rows = []
  for (const t of trips) t.pings.forEach((p, seq) => rows.push(`(${t.id},${seq},${p.dt},${p.lat},${p.lng},${p.kph})`))
  const CHUNK = 2000
  for (let i = 0; i < rows.length; i += CHUNK) {
    out.push('insert into public.trip_points (trip_id, seq, recorded_at, lat, lng, speed_kph)')
    out.push('select v.trip_id, v.seq, t.started_at + v.dt * interval \'1 second\', v.lat, v.lng, v.kph')
    out.push('from (values')
    out.push(rows.slice(i, i + CHUNK).join(',\n'))
    out.push(') as v(trip_id, seq, dt, lat, lng, kph) join public.trips t on t.id = v.trip_id;')
  }

  // trip events
  const evRows = []
  for (const t of trips) for (const e of t.events) evRows.push(`(${t.id},${t.vehicleId},${sqlStr(e.kind)},${e.dt},${e.lat},${e.lng},${e.value},${e.dur})`)
  out.push('insert into public.trip_events (trip_id, vehicle_id, kind, occurred_at, lat, lng, value, duration_s)')
  out.push('select v.trip_id, v.vehicle_id, v.kind, t.started_at + v.dt * interval \'1 second\', v.lat, v.lng, v.value, v.dur')
  out.push('from (values')
  out.push(evRows.join(',\n'))
  out.push(') as v(trip_id, vehicle_id, kind, dt, lat, lng, value, dur) join public.trips t on t.id = v.trip_id;')

  out.push('insert into public.alerts (vehicle_id, kind, severity, title, detail, raised_at, acknowledged_at) values')
  out.push(alerts.map((a) => `  (${a.vid}, ${sqlStr(a.kind)}, ${sqlStr(a.severity)}, ${sqlStr(a.title)}, ${sqlStr(a.detail)}, ${ts(a.raised)}, ${a.ack ? ts(a.ack) : 'null'})`).join(',\n') + ';')
  out.push('commit;')

  writeFileSync(OUT_FILE, out.join('\n') + '\n')

  // Report -----------------------------------------------------------------------------------
  const kb = Math.round(out.join('\n').length / 1024)
  console.log(`\nWrote ${OUT_FILE} (${kb} KB)`)
  console.log(`${trips.length} trips, ${rows.length} GPS points, ${evRows.length} events, ${alerts.length} alerts`)
  console.log('\nPer vehicle (all days): trips / overspeed events (24h) / total overspeed / halts')
  planned.forEach((p, i) => {
    const day0 = p.trips.filter((t) => t.startOffset > -24 * 3600)
    const o24 = day0.reduce((a, t) => a + t.stats.overspeed_count, 0)
    const oAll = p.trips.reduce((a, t) => a + t.stats.overspeed_count, 0)
    const hAll = p.trips.reduce((a, t) => a + t.stats.halt_count, 0)
    const avg = p.trips.reduce((a, t) => a + t.stats.avg_speed_kph, 0) / (p.trips.length || 1)
    console.log(`  ${VEHICLES[i].name.padEnd(10)} ${VEHICLES[i].role.padEnd(11)} ${String(p.trips.length).padStart(2)} trips  24h-over=${o24}  all-over=${oAll}  halts=${hAll}  avg=${avg.toFixed(1)} km/h`)
  })
  const dur = trips.map((t) => t.stats.duration_s / 60)
  console.log(`\nTrip duration min/avg/max: ${Math.min(...dur).toFixed(0)} / ${(dur.reduce((a, b) => a + b, 0) / dur.length).toFixed(0)} / ${Math.max(...dur).toFixed(0)} min`)
  console.log(`Day-0 schedule check (fictional now = ${fmtHm(NOW_TOD)}).`)
}

main().catch((e) => { console.error(e); process.exit(1) })
