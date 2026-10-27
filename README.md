# Fleetwatch — fleet operations dashboard

A small operations console for a delivery fleet: where every vehicle is, what it has been doing, and which ones need a human to look at them. React + TypeScript on the front, Supabase (Auth + Postgres) behind it, Leaflet for the map.

## Live demo

| | |
|---|---|
| **App** | `https://REPLACE-WITH-DEPLOYED-URL` |
| **Login** | `demo@fleetwatch.app` / `fleetwatch-demo` _(replace with the demo user you created)_ |
| **Walkthrough** | _(optional — add a link here)_ |

The login page has a "Fill demo credentials" button on builds where `VITE_DEMO_EMAIL` / `VITE_DEMO_PASSWORD` are set.

## What I built

**The workflow it is designed around** — an ops person opens the console and asks, in order:

1. *Is anything wrong?* The left card is a fleet list sorted by urgency, not alphabetically: critical alerts first, then warnings, then everything else grouped by what the vehicle is doing. Each row says *why* it is flagged ("Lost GPS signal mid-trip", "Low fuel — 14%") so you rarely need to click to triage. The header shows three numbers: vehicles moving, km driven in 24 h, open alerts.
2. *Where is everyone?* A full-bleed map shows all vehicles as status-coloured markers with a glyph for their state (heading arrow when moving, pause when idling, "P" when parked, a struck-through signal when offline, a wrench in the workshop). Vehicles with open alerts get a ring (pulsing for critical). Hovering a list row lights up its marker; hovering a marker shows a small card.
3. *What happened with this one?* Selecting a vehicle opens a detail card and flies the map to its latest trip. The route is drawn in, coloured by speed (slow / moving / over the limit), with start and end pins and pins for **overspeed**, **halt** and **hard-braking** events. A speed-over-time chart sits under the trip summary — hover or drag across it and a marker travels along the route; click an event in the list and the map flies to it.
4. *Deal with it.* Alerts can be acknowledged from the list, the Alerts tab or the vehicle card. A toast offers **Undo** for a while afterwards.

Selected vehicle and trip live in the URL hash (`#/v/3/t/36`), so reloading or sharing a link restores the view.

**Keyboard**: `/` search · `J` / `K` next / previous vehicle · `1` / `2` switch tabs · `Esc` close details (the account menu lists them too).

**Parameters I chose to surface, and why**

- *Right now* (per vehicle): speed or last-seen, ignition, distance in the last 24 h, fuel (ring), battery voltage (bar with the "low" mark), km to next service. These are the signals that predict "needs attention" — low fuel, no-start risk, overdue service, a dead tracker, an engine running for no distance.
- *Per trip*: distance, duration, average and maximum speed (red if over the vehicle's limit), idle time (as a share of the trip), halts. Overspeed and hard braking appear as badges on the trip row and as pins on the map.
- Deliberately left out: per-trip fuel economy, driver scoring, geofences. Not enough signal to be credible from seeded data, and they'd dilute the page.

**Stretch feature — alert triage.** Alerts are persisted, severity-ranked, shown on the vehicle list, map and detail card, acknowledgeable, undoable for 15 minutes (by whoever acknowledged), and paginated with an acknowledged-history view. I picked this over a route-comparison tool because "what needs attention" is the dashboard's stated job.

**Design.** A deliberately quiet UI: one accent colour, status shown with colour + glyph (never colour alone), hairlines instead of boxes, generous whitespace, self-hosted Inter. A custom SVG icon set (vehicles, statuses, telemetry), empty-state illustrations, and motion that explains rather than decorates — the route draws on, numbers ease to their new values, the detail card slides in, the tab underline glides. All of it switches off under `prefers-reduced-motion`. On phones the map sits on top and the panels become a bottom sheet.

## Local setup

Requirements: Node 20+ and a Supabase project (free tier is fine).

```bash
npm install
cp .env.example .env      # then fill in the values below
npm run dev               # http://localhost:5173
```

`.env`:

| Variable | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | same page → `anon` `public` key |
| `VITE_DEMO_EMAIL` / `VITE_DEMO_PASSWORD` | optional; shows the "Fill demo credentials" button |
| `SUPABASE_SERVICE_ROLE_KEY` | only needed by `npm run create-demo-user`; a server-side secret, never prefixed `VITE_` so it is never bundled |

Other scripts: `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` (unit tests for input sanitising and formatting).

> **Before zipping/sharing the project, remove `.env` and any `.env.local`** — they hold your keys. `.env.example` is the template reviewers should use.

## Supabase setup

All in the dashboard's SQL editor, in this order:

1. **Create a project.**
2. **Schema** — run [`supabase/migrations/20261027000000_init.sql`](supabase/migrations/20261027000000_init.sql).
3. **Hardening & pagination support** — run [`supabase/migrations/20261028000000_hardening_and_pagination.sql`](supabase/migrations/20261028000000_hardening_and_pagination.sql). (With the Supabase CLI, `supabase link` then `supabase db push` applies both in order.) The app needs this one: it adds the columns the paginated reads sort and search on.
4. **Sample data** — run [`supabase/seed.sql`](supabase/seed.sql) (~480 KB; if the editor is slow to paste, use `psql "$DATABASE_URL" -f supabase/seed.sql`). It truncates and reloads the fleet tables, so it is safe to re-run.
5. **Auth** — Authentication → Providers: keep *Email* enabled. For an internal tool, turn **off** "Allow new users to sign up". Create the demo user either:
   - in the dashboard: Authentication → Users → *Add user* → tick **Auto Confirm User**; or
   - with `npm run create-demo-user` (needs `SUPABASE_SERVICE_ROLE_KEY` in `.env`).
6. Copy the project URL and anon key into `.env`.

### Data model

```
drivers ─┐
         ├─< vehicles ─┬─< trips ─┬─< trip_points   (GPS breadcrumbs: lat, lng, speed per ping)
         │             │          └─< trip_events   (overspeed | halt | harsh_brake, pinned to a location)
         │             └─< alerts                   (offline, low_fuel, low_battery, service_due, overspeed, prolonged_idle)
demo_clock                                          (one row; see "Demo clock" below)
```

- **`vehicles`** holds identity (plate, make, driver, depot, speed limit) *and* the latest known state (`status`, position, speed, ignition, fuel, battery, `last_seen_at`, `status_since`).
- **`trips`** carries its own summary statistics (distance, duration, idle time, avg/max speed, event counts).
- **`trip_points`** is the raw route: one row per GPS ping (every 20 s), `(trip_id, seq)` primary key.
- **`trip_events`** are the things worth pinning on a map. **`alerts`** are what an operator acknowledges.
- The frontend reads through five views. `v_vehicles` joins the driver, 24 h totals, the open-alert count, the most severe open alert's title, a `sort_rank` (worst alert, then activity) and a lower-cased `search_text`, so the fleet list is one query that the database can sort, filter and page. `v_alerts` joins the vehicle name/plate.

## Production practices

**Input handling / SQL injection.** The app never builds SQL. Reads go through PostgREST (values travel as bound parameters) and the only writes are two RPCs with typed arguments. The remaining risk is the *meaning* of characters inside a value, so everything typed or read from the URL passes through [`src/lib/sanitize.ts`](src/lib/sanitize.ts) first: search text is trimmed, stripped of control characters and PostgREST's `*`, length-capped, and `%` `_` `\` are escaped so a search for `%` matches a literal percent sign instead of every row (unit-tested). Route ids from the URL hash are parsed strictly as positive integers. Vehicle names put into map-marker HTML are escaped. In the database, functions use `search_path = ''` and fully qualified names, and there is no dynamic SQL.

**Pagination.** No unbounded reads: the vehicle list (25), alerts (10) and trips per vehicle (8) are server-paged with "Show more" and an exact total (`count=exact`). The list is a growing `limit`, not append-by-offset, so background refreshes and acknowledgements can't duplicate or skip rows. GPS points are fetched in 1,000-row pages (PostgREST's default cap) so a long trip is never silently truncated. The map and header counts use one slim "snapshot" query, capped at 1,000 vehicles.

**Access control.** Row level security is on for every table with a `SELECT`-only policy for `authenticated`; views are `security_invoker`. On top of RLS, the migration revokes all privileges from `anon` and every write privilege from `authenticated`, so even a mistaken policy can't open a write path. The single write is `acknowledge_alert` / `unacknowledge_alert` (`SECURITY DEFINER`, empty `search_path`, require `auth.uid()`, can only touch two columns; undo only by the same user within 15 minutes). Execute rights are granted explicitly.

**Data integrity.** `CHECK` constraints reject impossible values (coordinates, negative distances, idle time greater than duration, an end before a start, oversized text), plus indexes for the paginated/filtered reads.

**Client resilience.** Every request has a 15 s deadline; out-of-order responses are dropped; polling pauses in hidden tabs; failures show inline errors while keeping the last good data; a React error boundary replaces a white screen with a recoverable one; the map bundle is code-split; a single `invalidate()` signal refreshes every list, badge and marker after a write.

**Deployment hardening.** [`vercel.json`](vercel.json) (and the Netlify equivalent [`public/_headers`](public/_headers)) set a strict Content-Security-Policy (self-only scripts; Supabase for `connect-src`; OpenStreetMap for tiles), `nosniff`, `frame-ancestors 'none'`, a referrer policy compatible with OSM's tile rules, a locked-down Permissions-Policy and immutable caching for hashed assets. I ran the production build under exactly this CSP and it loads with a clean console. If you use a custom Supabase domain, add it to `connect-src`.

## How the sample data is made

[`scripts/generate-seed.mjs`](scripts/generate-seed.mjs) produces `seed.sql` (re-runnable with `npm run seed:generate`; the OSRM road geometry it needs is cached in `scripts/.osrm-cache.json`). It builds 12 vehicles and 148 trips around Bengaluru, over 4 days:

- Routes follow **real roads** (geometry and per-segment free-flow speeds from the public OSRM server).
- Driving is **simulated second by second** — acceleration limits, congestion, traffic-signal stops, stationary warm-up, an occasional hard brake, and drivers with different aggression levels — then sampled into GPS pings. Trip statistics and events are *computed from that telemetry*, so a trip's "max speed", the red segments on its route and the overspeed pins always agree.
- Vehicles are placed in distinct "right now" situations on purpose: 4 moving (with a trip in progress), 2 idling, 4 parked, 1 offline mid-route, 1 in the workshop; two low on fuel, one with a weak battery, one about to be overdue for service, and two drivers who speed.

## Technical decisions

- **Stack**: Vite + React 19 + TypeScript (strict). No state library or router: a small query hook (`usePolled`: keyed fetch, polling, stale-while-revalidate, invalidation) and the URL hash cover it.
- **Map library — Leaflet (`react-leaflet`)** over Mapbox/Google: no API key or billing for reviewers, tiny, and sufficient for markers and polylines. Tiles are OpenStreetMap, visually muted with a CSS filter so the route colours carry the information. All camera movement lives in one `ViewController` and uses `flyToBounds` — Leaflet silently drops a `fitBounds` that arrives during a zoom animation, which is exactly what selecting a vehicle and then loading its route does. Panels float over the map, so fits are padded to aim at the free area.
- **Denormalised "latest state" on `vehicles` and stats on `trips`**: list screens never aggregate raw telemetry. The cost is that something must keep those columns in sync (an ingestion pipeline in production; the generator here). Raw points are kept, so stats are always re-derivable.
- **Alerts as stored rows, not derived in the client**: acknowledgement needs state, and rules (thresholds, de-duplication, severity) belong near the data. In production a rules job over telemetry would write them; here they are seeded.
- **Views as the read API**: one place to join and shape data, hide columns, and keep the demo clock out of the app code.

### Assumptions and trade-offs

- **Demo clock.** Seed data is generated "as of" one instant. So the demo doesn't go stale, the views add `now() - demo_clock.anchor` to every stored timestamp. Side effects: times of day are relative to when you ran the seed, and ordering by a shifted timestamp can't use an index (irrelevant at this scale). In a real deployment delete `demo_clock` and select the columns directly.
- **No live telemetry**: positions don't move between refreshes. A realtime channel (Supabase Realtime on `vehicles`) would be the next step; I chose not to fake movement.
- **`count=exact`** is cheap here; at large scale switch to `planned`/`estimated` counts. The 1,000-vehicle snapshot cap is where the map should move to viewport queries.
- **Single role.** Any authenticated user can read everything and acknowledge alerts. Real use would want roles and per-fleet scoping in the RLS policies.
- **OpenStreetMap's public tile server** is fine for a review/demo; production should use a tile provider.
- **Testing.** Unit tests cover sanitising and formatting. I verified the UI in a browser against a local Postgres stand-in for Supabase (so I could exercise the real migrations, seed, RLS and RPCs), including the production build under the CSP. There are no browser-automation tests.

## AI usage

> _Edit this section so it reflects your own process before submitting._

**Tools:** Claude Code (Claude Sonnet 5.5) in the Claude desktop app, driving my editor, terminal and browser. Chat logs: see [`AI_CHAT_LOGS.md`](AI_CHAT_LOGS.md).

**Where it helped**

- Scaffolding the Vite/React/TS project and the Supabase schema, views, RLS policies and RPCs, then a second pass for hardening (constraints, least privilege, pagination support).
- Writing the seed generator (OSRM routing + driving simulation) so telemetry, trip stats and alerts are internally consistent.
- Building the components, the custom icon set and the responsive CSS, and driving the running app in a browser to look at it and fix what looked wrong.

**How output was reviewed / where it was changed**

- *Basemap*: the first draft used CARTO's free "light" tiles; they rendered with an "API KEY REQUIRED" watermark, so I switched to OpenStreetMap and muted it with a CSS filter.
- *Seed realism*: the first generated data had trips averaging ~5 km/h lasting hours — a simulator end-of-route bug (vehicles crept forever). Found from the per-vehicle summary the script prints, then fixed. Reviewing the UI then showed "hard braking from 12 km/h", so hazards now fire only above ~30 km/h and repeated detections collapse into one event.
- *Map camera*: after the redesign, selecting a vehicle left the map zoomed on the vehicle instead of its route. Tracing it showed Leaflet ignoring a `fitBounds` issued mid-animation; I replaced it with `flyToBounds`. I also dropped canvas rendering because routes lagged the markers during flights.
- *Search safety*: a raw `%` in the search box matched every vehicle when I tested it against the database; that is why search text is escaped before it reaches an `ILIKE`.
