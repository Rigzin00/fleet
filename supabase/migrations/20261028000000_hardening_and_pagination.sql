-- Hardening, server-side search and pagination support.
-- Run after 20261027000000_init.sql (and before or after seed.sql — both orders work).

-- ---------------------------------------------------------------------------
-- 1. Data integrity: reject impossible values at the database, not just in the app
-- ---------------------------------------------------------------------------

alter table public.vehicles
  add constraint vehicles_position_chk check (last_lat between -90 and 90 and last_lng between -180 and 180),
  add constraint vehicles_heading_chk  check (last_heading between 0 and 360),
  add constraint vehicles_speed_chk    check (last_speed_kph >= 0 and speed_limit_kph between 5 and 200),
  add constraint vehicles_battery_chk  check (battery_v between 0 and 30),
  add constraint vehicles_odometer_chk check (odometer_km >= 0 and next_service_km >= 0),
  add constraint vehicles_text_chk     check (char_length(reg_number) between 3 and 20 and char_length(name) between 1 and 60);

alter table public.trips
  add constraint trips_stats_chk check (
    distance_km >= 0 and duration_s >= 0 and idle_s between 0 and duration_s
    and avg_speed_kph >= 0 and max_speed_kph >= 0
    and halt_count >= 0 and overspeed_count >= 0 and harsh_brake_count >= 0),
  add constraint trips_time_chk  check (ended_at is null or ended_at >= started_at);

alter table public.trip_points
  add constraint trip_points_chk check (lat between -90 and 90 and lng between -180 and 180 and speed_kph between 0 and 300);

alter table public.trip_events
  add constraint trip_events_chk check (lat between -90 and 90 and lng between -180 and 180 and value >= 0 and duration_s >= 0);

alter table public.alerts
  add constraint alerts_text_chk check (char_length(title) between 1 and 200 and (detail is null or char_length(detail) <= 1000));

-- ---------------------------------------------------------------------------
-- 2. Indexes for the paginated / filtered reads
-- ---------------------------------------------------------------------------

create index vehicles_status_idx       on public.vehicles (status);
create index alerts_raised_idx         on public.alerts (raised_at desc);
create index alerts_vehicle_raised_idx on public.alerts (vehicle_id, raised_at desc);

-- ---------------------------------------------------------------------------
-- 3. Functions: empty search_path (no schema-shadowing), fully qualified names
-- ---------------------------------------------------------------------------

create or replace function public.demo_offset() returns interval
language sql stable security invoker set search_path = ''
as $$ select coalesce((select now() - anchor from public.demo_clock), interval '0') $$;

drop function public.acknowledge_alert(bigint);

-- Returns true when this call changed the alert (false: unknown id or already acknowledged).
create function public.acknowledge_alert(p_alert_id bigint) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  changed int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  update public.alerts
     set acknowledged_at = now(), acknowledged_by = auth.uid()
   where id = p_alert_id and acknowledged_at is null;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

-- Undo: only by the person who acknowledged it, and only for 15 minutes (keeps the audit trail honest).
create function public.unacknowledge_alert(p_alert_id bigint) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  changed int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  update public.alerts
     set acknowledged_at = null, acknowledged_by = null
   where id = p_alert_id
     and acknowledged_by = auth.uid()
     and acknowledged_at > now() - interval '15 minutes';
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Read views, rebuilt with the columns that pagination / search need
-- ---------------------------------------------------------------------------

drop view public.v_vehicles;
drop view public.v_alerts;

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
  case a.sev_rank when 0 then 'critical' when 1 then 'warning' when 2 then 'info' end as top_alert_severity,
  a.top_title                   as top_alert_title,
  -- lower sorts first: worst open alert, then what the vehicle is doing
  coalesce(a.sev_rank, 3) * 10
    + case v.status when 'moving' then 0 when 'idle' then 1 when 'offline' then 2 when 'stopped' then 3 else 4 end
    as sort_rank,
  -- one lower-cased column so a search is a single parameterised ILIKE
  lower(concat_ws(' ', v.name, v.reg_number, d.full_name, v.make_model)) as search_text
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
         min(case x.severity when 'critical' then 0 when 'warning' then 1 else 2 end) as sev_rank,
         (array_agg(x.title order by case x.severity when 'critical' then 0 when 'warning' then 1 else 2 end, x.raised_at desc))[1] as top_title
  from public.alerts x
  where x.vehicle_id = v.id and x.acknowledged_at is null
) a on true;

create view public.v_alerts with (security_invoker = true) as
select a.id, a.vehicle_id, v.name as vehicle_name, v.reg_number as vehicle_reg,
       a.kind, a.severity,
       case a.severity when 'critical' then 0 when 'warning' then 1 else 2 end as severity_rank,
       a.title, a.detail,
       a.raised_at + public.demo_offset() as raised_at,
       a.acknowledged_at
from public.alerts a
join public.vehicles v on v.id = a.vehicle_id;

-- ---------------------------------------------------------------------------
-- 5. Least privilege (RLS stays the primary guard; this is defence in depth)
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.demo_offset()                 to authenticated;
grant execute on function public.acknowledge_alert(bigint)     to authenticated;
grant execute on function public.unacknowledge_alert(bigint)   to authenticated;
