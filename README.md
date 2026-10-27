# Fleetwatch — Fleet Operations Dashboard

A real-time fleet operations console built for logistics and dispatch teams to monitor fleet health, track live trips, inspect historical telemetry, and triage urgent vehicle alerts. Built with **React 19**, **TypeScript**, **Supabase (PostgreSQL + Auth + RLS)**, and **Leaflet**.

---

## Live Demo

| Property | Details |
|---|---|
| **Live Deployed App** | [https://fleet-ten-theta.vercel.app/](https://fleet-ten-theta.vercel.app/) |
| **Demo Login Email** | `demo@fleetwatch.test` |
| **Demo Password** | `demo-pass` |
| **One-Click Login** | The login screen includes a **"Fill demo credentials"** button for instant evaluation |
| **Walkthrough** | Optional video walkthrough link: *(Record & insert link here if desired)* |

---

## Project Overview

### What Was Built
Fleetwatch is an end-to-end web dashboard tailored for delivery and logistics dispatchers. It provides:
1. **Interactive Global & Route Map:** Full-viewport Leaflet map displaying real-time vehicle locations with status-coded markers (moving, idling, parked, offline, maintenance), directional heading arrows, and alert status indicators.
2. **Context-Rich Fleet Explorer:** A prioritised fleet list sorted by operational urgency (critical alerts first, warnings second, moving vehicles third).
3. **Trip History & GPS Breadcrumb Playback:** Visualisation of historic trips rendered with speed-banded color polylines (slow, normal, overspeed), start/finish pins, and hazard markers (harsh braking, halts, overspeeding).
4. **Interactive Telemetry Timeline:** Speed-over-time charts synchronized with route playback—hovering across the scrub bar slides a synchronized marker along the actual street coordinates.
5. **Real-time Alert Triage:** An alert acknowledgment lifecycle backed by PostgreSQL security-definer RPCs, allowing dispatchers to triage alerts with a 15-minute undo grace period.

### Main Product Decisions
- **Urgency-First Sorting:** Operational dashboards should never sort vehicles alphabetically by default. Fleetwatch sorts by alert severity (`critical` → `warning` → `healthy`) and activity state (`moving` → `idle` → `parked` → `offline` → `in_shop`), ensuring failing trackers or low-fuel delivery vans are noticed immediately.
- **Surface Operational Signals Over Generic Data:** Instead of vanity metrics (e.g. hypothetical eco-scores), Fleetwatch surfaces actionable predictive indicators: ignition state, 24-hour distance, fuel percentage, 12V battery voltage (with critical discharge threshold indicators), and distance remaining to the next scheduled maintenance service.
- **Deep-Linkable State via URL Hash:** The active vehicle and trip state are bound to the URL hash (e.g., `#/v/3/t/36`). Dispatchers can refresh the tab or share specific vehicle/trip URLs with team members without losing context.
- **Keyboard-Driven Power Shortcuts:** Operators spend hours in dashboards. Fleetwatch supports `/` (search), `J` / `K` (next / previous vehicle), `1` / `2` (toggle fleet vs. alert tabs), and `Esc` (close vehicle detail pane).
- **Subtle, Purposeful Aesthetics:** Custom SVG iconography, accessible contrast ratios, color + glyph dual-encoding (ensuring colorblind accessibility), and strict adherence to `prefers-reduced-motion`.

### Intended Operations-User Workflow
A delivery fleet dispatcher uses Fleetwatch through the following four-step operational loop:
1. **Triage & Spot Anomalies:** The dispatcher opens the dashboard at shift start. The top summary bar indicates total active vehicles, 24h fleet mileage, and pending alerts. Critical alerts (such as "Lost GPS signal mid-trip" or "Battery voltage critical") appear at the top of the sidebar with high-visibility badges.
2. **Locate & Assess Context:** Clicking a flagged vehicle triggers a smooth camera fly (`flyToBounds`) to the vehicle's position, centering the vehicle while accounting for floating overlay sidebars.
3. **Investigate Telemetry & Trips:** The dispatcher selects the vehicle's recent trip to inspect breadcrumbs. Red polyline segments immediately highlight where speed limits were violated. Scrubbing across the speed chart or clicking an event pin (e.g., "Harsh Braking at 52 km/h") instantly highlights the exact intersection where the incident occurred.
4. **Acknowledge & Resolve:** The dispatcher contacts the driver or depot manager and clicks **"Acknowledge"**. The alert is removed from the active triage queue, with an undo toast available in case of misclicks.

---

## Local Setup

### Prerequisites
- **Node.js**: v20.0.0 or later
- **npm**: v10.0.0 or later
- A free **Supabase** account (or local Supabase CLI instance)

### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Rigzin00/fleet.git
   cd fleet
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory by copying the example template:
   ```bash
   cp .env.example .env
   ```
   Populate `.env` with your Supabase credentials:
   ```env
   # Supabase Public API Configuration
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

   # Optional Demo Credentials (enables "Fill demo credentials" on login screen)
   VITE_DEMO_EMAIL=demo@fleetwatch.test
   VITE_DEMO_PASSWORD=demo-pass

   # Secret Service Role Key (Used ONLY by administrative scripts like npm run create-demo-user; NEVER bundled into client)
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

4. **Run the Project Locally:**
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:5173`.

5. **Additional NPM Scripts:**
   - `npm run build`: Compiles production TypeScript bundle into `dist/`.
   - `npm run typecheck`: Runs strict TypeScript compiler check (`tsc --noEmit`).
   - `npm run lint`: Runs ESLint code quality checks.
   - `npm test`: Executes Vitest unit tests (covering input sanitization and unit formatting).

---

## Supabase Setup

Follow these steps to reproduce the complete backend schema, policies, RPCs, and sample datasets:

### 1. Execute Database Migrations
In your Supabase project dashboard, navigate to the **SQL Editor** (or use the Supabase CLI) and execute the SQL migration scripts in order:

1. **Base Schema & Views:** Execute [`supabase/migrations/20261027000000_init.sql`](supabase/migrations/20261027000000_init.sql)
   - Creates tables: `drivers`, `vehicles`, `trips`, `trip_points`, `trip_events`, `alerts`, `demo_clock`.
   - Configures database constraints (`CHECK` constraints for speeds, coordinates, timestamps).
   - Establishes read-optimized database views: `v_vehicles`, `v_trips`, `v_alerts`.
   - Sets up initial Row Level Security (RLS) policies.
2. **Hardening, RPCs & Pagination Indexing:** Execute [`supabase/migrations/20261028000000_hardening_and_pagination.sql`](supabase/migrations/20261028000000_hardening_and_pagination.sql)
   - Revokes table privileges from `anon` and public write access from `authenticated`.
   - Creates security-definer RPC functions for alert acknowledgment (`acknowledge_alert` and `unacknowledge_alert`) with empty `search_path` to prevent search path hijacking.
   - Adds compound indexes for cursor/offset-based server-side pagination and full-text search (`search_text`).

### 2. Main Tables & Relationships

```
┌──────────────┐
│   drivers    │
└──────┬───────┘
       │ 1:N
┌──────▼───────┐          1:N          ┌──────────────┐
│   vehicles   ├──────────────────────►│    alerts    │
└──────┬───────┘                       └──────────────┘
       │ 1:N
┌──────▼───────┐          1:N          ┌──────────────┐
│    trips     ├──────────────────────►│ trip_events  │
└──────┬───────┘                       └──────────────┘
       │ 1:N
┌──────▼───────┐
│ trip_points  │ (GPS breadcrumbs: lat, lng, speed, heading, seq)
└──────────────┘
```

- **`vehicles`**: Holds both static identity (plate, VIN, make, model, speed limit, driver reference) and latest telemetry snapshot (`status`, `lat`, `lng`, `speed`, `ignition`, `fuel_percent`, `battery_voltage`, `last_seen_at`).
- **`trips`**: Pre-aggregated metrics per journey (`distance_km`, `duration_seconds`, `idle_seconds`, `avg_speed_kmh`, `max_speed_kmh`, `overspeed_count`, `harsh_brake_count`).
- **`trip_points`**: Raw time-series GPS pings (sampled every 20 seconds) indexed by `(trip_id, seq)`.
- **`trip_events`**: Categorized telemetry hazards pinned to specific coordinates (`overspeed`, `halt`, `harsh_brake`).
- **`alerts`**: Persistent operator notifications (`offline`, `low_fuel`, `low_battery`, `service_due`, `overspeed`, `prolonged_idle`) with resolution states (`is_acknowledged`, `acknowledged_at`, `acknowledged_by`).
- **`demo_clock`**: Stores an anchor timestamp allowing seed data timestamps to float forward dynamically relative to `now()`, keeping demo telemetry fresh.

### 3. Seed Realistic Sample Data
Run [`supabase/seed.sql`](supabase/seed.sql) in the Supabase SQL Editor (or via `psql` command line):
```bash
psql "$DATABASE_URL" -f supabase/seed.sql
```
*Note:* The seed file contains 12 realistic delivery vehicles operating across Bengaluru across 4 consecutive days, with 148 fully simulated trips and over 18,000 OSRM road-snapped GPS coordinates.

### 4. Authentication Configuration
1. In the Supabase Dashboard, go to **Authentication** → **Providers** → Ensure **Email** is enabled.
2. In **Authentication** → **Configuration**, toggle **Off** "Allow new users to sign up" (ensuring internal tool access security).
3. Create the demo operator user either via:
   - **Dashboard:** **Authentication** → **Users** → **Add user** → Email: `demo@fleetwatch.test`, Password: `demo-pass` (Make sure to check **Auto Confirm User**).
   - **CLI Script:** Run `npm run create-demo-user` with `SUPABASE_SERVICE_ROLE_KEY` populated in `.env`.

---

## Technical Decisions

### Architecture Choices
- **Zero Heavy State Management Overhead:** Rather than introducing Redux or heavy client stores, Fleetwatch utilizes a purpose-built, high-resilience data hook ([`src/lib/usePolled.ts`](src/lib/usePolled.ts)). It handles:
  - Cache deduplication and automatic background polling with tab visibility detection (pauses polling when tab is inactive to save bandwidth).
  - Stale-while-revalidate data presentation with inline retry handling.
  - Centralized cache invalidation signal (`invalidate()`) for instant consistency after alert acknowledgments.
- **Strict Server-Side Views (`v_vehicles`, `v_trips`, `v_alerts`):** Rather than performing multi-table joins or client-side filtering, data is served through optimized PostgreSQL views. `v_vehicles` combines driver details, open alert counts, urgency sort rank, and pre-computed lowercase search tokens into a single roundtrip.
- **URL Hash Routing:** Using hash routes (`#/v/:id/t/:tripId`) eliminates the need for full client-side router bundles and avoids hosting rewrites while enabling robust deep linking.

### Data Model Decisions & Trade-offs
- **Denormalized "Latest State" on `vehicles`:** Storing current position, fuel, and last seen timestamps directly on `vehicles` avoids running heavy aggregates over millions of raw `trip_points` when rendering the map or fleet list.
- **Alerts as Stored Relational Records:** Generated alerts are stored as actual database records rather than calculated on-the-fly in JavaScript. This allows audit trails, acknowledgment ownership tracking, and undo operations.
- **The Demo Clock Pattern:** Static seed timestamps inevitably get stale. `demo_clock` stores a reference anchor. Database views project timestamps using `now() - demo_clock.anchor`, ensuring relative timestamps like "2 minutes ago" or "Yesterday" remain realistic whenever a reviewer tests the app.

### Map Library Choice: Leaflet (`react-leaflet`)
- **Why Leaflet over Mapbox GL or Google Maps:** Leaflet is lightweight, open-source, and does not require private API keys, credit card setups, or billing limits for recruiters and evaluators.
- **OpenStreetMap Tile Optimization:** Standard OSM tiles were styled with a specialized CSS contrast and saturation filter (`filter: grayscale(...) contrast(...)`), yielding an unobtrusive modern dark/muted basemap that allows color-coded speed routes to stand out clearly.
- **Camera Orchestration via `flyToBounds`:** Standard Leaflet `fitBounds` calls can fail or freeze if called while a prior zoom animation is executing. Fleetwatch centralizes all camera changes inside [`src/components/map/ViewController.tsx`](src/components/map/ViewController.tsx) using `flyToBounds` with viewport padding to prevent floating panels from obscuring markers.

### Production Hardening & Security
- **Strict SQL Injection Mitigation:** Zero raw SQL strings. All queries run through PostgREST parameterized calls. User inputs and URL route parameters are passed through [`src/lib/sanitize.ts`](src/lib/sanitize.ts), which strips wildcards (`%`, `_`), prevents PostgREST filter injection, and validates integer IDs.
- **Least-Privilege Security Model:** Anon privileges are fully revoked. Authenticated users are restricted to read-only access on base tables. Writes are only permitted through `SECURITY DEFINER` RPC functions with explicit argument typing and validation.
- **Production Content Security Policy (CSP):** Deployed with strict security headers configured in [`vercel.json`](vercel.json) and [`public/_headers`](public/_headers), including `default-src 'self'`, whitelisted Supabase websocket/API endpoints, and OSM tile sources.

---

## AI Usage

Full conversation transcripts and development phase logs are recorded in [`AI_CHAT_LOGS.md`](AI_CHAT_LOGS.md).

### AI Tools Used
- **Google Antigravity (Claude Sonnet 4.6 Thinking / Gemini 3.8 Flash):** Used as the primary AI pair-programming assistant for architecture, schema design, simulation scripts, and frontend component engineering.

### Where AI Was Used
1. **Initial Architecture & Scaffolding:** Drafting the project structure, typing definitions, and Vite configuration.
2. **Database Migration & Hardening:** Formulating PostgreSQL schemas, index strategies, `CHECK` constraints, view definitions, and atomic RPC functions.
3. **OSRM Route Seed Generator ([`scripts/generate-seed.mjs`](scripts/generate-seed.mjs)):** Crafting the second-by-second vehicle physics simulation (simulating acceleration, traffic signal delays, braking, and GPS jitter) and caching real Bengaluru road network geometries.
4. **UI & Visualization Components:** Generating custom accessible SVG icon sets, status badges, speed timeline charts, and responsive CSS stylesheets.

### How AI-Assisted Output Was Reviewed & Modified
- **OSRM Road Snapping & Route Crawl Fix:** Initial AI-generated telemetry suffered from an end-of-route bug where vehicles crawled indefinitely at 5 km/h. During review, the physics simulation loop was modified to enforce strict destination snap thresholds and realistic arrival standstills.
- **Hard Braking Realism Thresholds:** Early seed outputs flagged hard braking events even at low crawl speeds (e.g., 10 km/h in traffic). The threshold logic was rewritten to require initial speeds ≥30 km/h with deceleration >4.5 m/s² before logging hazard events.
- **Leaflet Camera Collision Management:** AI generated standard `fitBounds` calls that collided with concurrent vehicle selection events. This was debugged and refactored into a single controller with layout-aware padding.
- **PostgREST Wildcard Sanitization:** Discovered during security review that typing `%` in search filters bypassed intended filtering; wrote custom sanitization regex logic and verified with unit tests in `src/lib/sanitize.test.ts`.

---

## Optional Walkthrough
- **Application URL:** [https://fleet-ten-theta.vercel.app/](https://fleet-ten-theta.vercel.app/)
- **Demo Credentials:** `demo@fleetwatch.test` / `demo-pass`
