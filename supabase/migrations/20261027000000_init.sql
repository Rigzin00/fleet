-- Fleet dashboard schema.
-- Run once on a fresh Supabase project (SQL editor or `supabase db push`), then run supabase/seed.sql.

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------

create table public.drivers (
  id          bigint generated always as identity primary key,
  full_name   text not null,
  phone       text,
  licence_no  text
);

create table public.vehicles (
  id               bigint generated always as identity primary key,
  reg_number       text not null unique,
  name             text not null,                      -- fleet nickname, e.g. "Van 03"
  kind             text not null check (kind in ('van', 'truck', 'car', 'pickup')),
  make_model       text not null,
  driver_id        bigint references public.drivers (id) on delete set null,
  depot            text not null,
  speed_limit_kph  int  not null default 60,           -- per-vehicle overspeed threshold

  -- Latest known state. Denormalised from telemetry so the fleet list is one cheap query.
  status           text not null check (status in ('moving', 'idle', 'stopped', 'offline', 'maintenance')),
  ignition         boolean not null default false,
  last_lat         double precision not null,
  last_lng         double precision not null,
  last_heading     int not null default 0,
  last_speed_kph   numeric(5, 1) not null default 0,
  last_seen_at     timestamptz not null,
  status_since     timestamptz not null,               -- when the current status began (idle/offline duration)

  fuel_pct         numeric(4, 1) not null check (fuel_pct between 0 and 100),
  battery_v        numeric(4, 1) not null,             -- 12V starter battery voltage
  odometer_km      int not null,
  next_service_km  int not null
);

create table public.trips (
  id             bigint generated always as identity primary key,
  vehicle_id     bigint not null references public.vehicles (id) on delete cascade,
  driver_id      bigint references public.drivers (id) on delete set null,
  started_at     timestamptz not null,
  ended_at       timestamptz,                          -- null = still in progress
  start_name     text not null,
  end_name       text not null,

  -- Summary stats are stored on the trip (computed once at trip close), so the trip list never has
  -- to aggregate trip_points. For an in-progress trip they are "as of the last point".
  distance_km    numeric(6, 2) not null,
  duration_s     int not null,
  idle_s         int not null,
  avg_speed_kph  numeric(5, 1) not null,
  max_speed_kph  numeric(5, 1) not null,
  halt_count     int not null default 0,
  overspeed_count int not null default 0,
  harsh_brake_count int not null default 0
);
create index trips_vehicle_started_idx on public.trips (vehicle_id, started_at desc);

-- GPS breadcrumbs. One row per ping; speed is kept per point so the route can be coloured by speed.
create table public.trip_points (
  trip_id      bigint not null references public.trips (id) on delete cascade,
  seq          int not null,
  recorded_at  timestamptz not null,
  lat          double precision not null,
  lng          double precision not null,
  speed_kph    numeric(5, 1) not null,
  primary key (trip_id, seq)
);

-- Discrete things that happened during a trip, pinned to a location on the map.
create table public.trip_events (
  id           bigint generated always as identity primary key,
  trip_id      bigint not null references public.trips (id) on delete cascade,
  vehicle_id   bigint not null references public.vehicles (id) on delete cascade,
  kind         text not null check (kind in ('overspeed', 'halt', 'harsh_brake')),
  occurred_at  timestamptz not null,
  lat          double precision not null,
  lng          double precision not null,
  value        numeric(6, 1) not null,                 -- overspeed: peak km/h, halt: seconds, harsh_brake: peak km/h before braking
  duration_s   int not null default 0
);
create index trip_events_trip_idx on public.trip_events (trip_id);

-- Fleet-level things an operator should look at. In production a rules engine over telemetry would
-- write these; here they are seeded. Acknowledging is the only write the UI performs.
create table public.alerts (
  id               bigint generated always as identity primary key,
  vehicle_id       bigint not null references public.vehicles (id) on delete cascade,
  kind             text not null check (kind in ('offline', 'low_fuel', 'low_battery', 'service_due', 'overspeed', 'prolonged_idle')),
  severity         text not null check (severity in ('critical', 'warning', 'info')),
  title            text not null,
  detail           text,
  raised_at        timestamptz not null,
  acknowledged_at  timestamptz,
  acknowledged_by  uuid references auth.users (id) on delete set null
);
create index alerts_open_idx on public.alerts (vehicle_id) where acknowledged_at is null;

-- ---------------------------------------------------------------------------
-- Demo clock
-- ---------------------------------------------------------------------------
-- The sample data is generated "as of" one instant. So the demo never looks stale, the views below
-- shift every stored timestamp forward by (now() - anchor). In a real deployment you would delete
-- this table and select the base columns directly.

create table public.demo_clock (
  singleton  boolean primary key default true check (singleton),
  anchor     timestamptz not null
);

create function public.demo_offset() returns interval
language sql stable security invoker
as $$ select coalesce((select now() - anchor from public.demo_clock), interval '0') $$;

-- ---------------------------------------------------------------------------
-- Read views (what the frontend queries)
-- ---------------------------------------------------------------------------

create view public.v_vehicles with (security_invoker = true) as
select
  v.id, v.reg_number, v.name, v.kind, v.make_model, v.driver_id,
  d.full_name  as driver_name,
  d.phone      as driver_phone,
  v.depot, v.speed_limit_kph, v.status, v.ignition,
  v.last_lat, v.last_lng, v.last_heading, v.last_speed_kph,
  v.last_seen_at + public.demo_offset()   as last_seen_at,
  v.status_since + public.demo_offset()   as status_since,
  v.fuel_pct, v.battery_v, v.odometer_km, v.next_service_km,
  coalesce(s.trips_24h, 0)      as trips_24h,
  coalesce(s.distance_24h, 0)   as distance_24h_km,
  coalesce(s.overspeed_24h, 0)  as overspeed_24h,
  coalesce(a.open_alerts, 0)    as open_alerts,
  a.top_severity                as top_alert_severity
from public.vehicles v
left join public.drivers d on d.id = v.driver_id
left join lateral (
  select count(*) as trips_24h,
         sum(t.distance_km)::numeric(8, 1) as distance_24h,
         sum(t.overspeed_count) as overspeed_24h
  from public.trips t
  where t.vehicle_id = v.id
    and t.started_at + public.demo_offset() > now() - interval '24 hours'
) s on true
left join lateral (
  select count(*) as open_alerts,
         case min(case severity when 'critical' then 0 when 'warning' then 1 else 2 end)
           when 0 then 'critical' when 1 then 'warning' when 2 then 'info' end as top_severity
  from public.alerts x
  where x.vehicle_id = v.id and x.acknowledged_at is null
) a on true;

create view public.v_trips with (security_invoker = true) as
select
  t.id, t.vehicle_id, t.driver_id,
  t.started_at + public.demo_offset() as started_at,
  t.ended_at   + public.demo_offset() as ended_at,
  t.start_name, t.end_name,
  t.distance_km, t.duration_s, t.idle_s, t.avg_speed_kph, t.max_speed_kph,
  t.halt_count, t.overspeed_count, t.harsh_brake_count
from public.trips t;

create view public.v_trip_points with (security_invoker = true) as
select p.trip_id, p.seq, p.recorded_at + public.demo_offset() as recorded_at,
       p.lat, p.lng, p.speed_kph
from public.trip_points p;

create view public.v_trip_events with (security_invoker = true) as
select e.id, e.trip_id, e.vehicle_id, e.kind,
       e.occurred_at + public.demo_offset() as occurred_at,
       e.lat, e.lng, e.value, e.duration_s
from public.trip_events e;

create view public.v_alerts with (security_invoker = true) as
select a.id, a.vehicle_id, a.kind, a.severity, a.title, a.detail,
       a.raised_at + public.demo_offset() as raised_at,
       a.acknowledged_at
from public.alerts a;

-- ---------------------------------------------------------------------------
-- Row level security: any signed-in user can read; nobody writes directly.
-- ---------------------------------------------------------------------------

alter table public.drivers      enable row level security;
alter table public.vehicles     enable row level security;
alter table public.trips        enable row level security;
alter table public.trip_points  enable row level security;
alter table public.trip_events  enable row level security;
alter table public.alerts       enable row level security;
alter table public.demo_clock   enable row level security;

create policy "authenticated read" on public.drivers     for select to authenticated using (true);
create policy "authenticated read" on public.vehicles    for select to authenticated using (true);
create policy "authenticated read" on public.trips       for select to authenticated using (true);
create policy "authenticated read" on public.trip_points for select to authenticated using (true);
create policy "authenticated read" on public.trip_events for select to authenticated using (true);
create policy "authenticated read" on public.alerts      for select to authenticated using (true);
create policy "authenticated read" on public.demo_clock  for select to authenticated using (true);

grant select on public.v_vehicles, public.v_trips, public.v_trip_points,
                public.v_trip_events, public.v_alerts to authenticated;
revoke all on public.v_vehicles, public.v_trips, public.v_trip_points,
              public.v_trip_events, public.v_alerts from anon;

-- The one write path: acknowledging an alert. A function (rather than an UPDATE policy) so the
-- client can only ever set the two acknowledgement columns.
create function public.acknowledge_alert(p_alert_id bigint) returns void
language sql security definer set search_path = public
as $$
  update public.alerts
     set acknowledged_at = now(), acknowledged_by = auth.uid()
   where id = p_alert_id and acknowledged_at is null;
$$;
revoke execute on function public.acknowledge_alert(bigint) from public, anon;
grant  execute on function public.acknowledge_alert(bigint) to authenticated;
