import { useState } from 'react'
import { PAGE_SIZE, useAlertPage } from '../hooks/useFleetData'
import { timeAgo, useNow } from '../lib/format'
import type { Alert } from '../lib/types'
import { Icon, Illustration } from './icons'
import { SeverityTag } from './ui'

interface CardProps {
  alert: Alert
  showVehicle: boolean
  onSelectVehicle?: (id: number) => void
  onAcknowledge: (id: number) => Promise<void>
}

function AlertCard({ alert: a, showVehicle, onSelectVehicle, onAcknowledge }: CardProps) {
  const now = useNow()
  const [busy, setBusy] = useState(false)
  const done = a.acknowledged_at !== null

  async function acknowledge() {
    setBusy(true)
    try {
      await onAcknowledge(a.id)
    } catch {
      setBusy(false) // the caller has already told the user why
    }
  }

  return (
    <li className={`alert alert-${a.severity} ${busy ? 'leaving' : ''} ${done ? 'is-done' : ''}`}>
      <div className="alert-top">
        <SeverityTag severity={a.severity}>{a.severity}</SeverityTag>
        {showVehicle && (
          <button className="link" onClick={() => onSelectVehicle?.(a.vehicle_id)} title={`${a.vehicle_name} · ${a.vehicle_reg}`}>
            {a.vehicle_name}
          </button>
        )}
        <time className="alert-time" dateTime={a.raised_at}>{timeAgo(a.raised_at, now)}</time>
      </div>
      <div className="alert-title">{a.title}</div>
      {a.detail && <p className="alert-detail">{a.detail}</p>}
      {done ? (
        <div className="alert-foot">Acknowledged {timeAgo(a.acknowledged_at as string, now)}</div>
      ) : (
        <button className="btn btn-quiet btn-small" onClick={acknowledge} disabled={busy}>
          <Icon name="check" size={13} stroke={2.2} /> {busy ? 'Acknowledging…' : 'Acknowledge'}
        </button>
      )}
    </li>
  )
}

interface Props {
  /** Scope to one vehicle; omit for the whole fleet. */
  vehicleId?: number | null
  onSelectVehicle?: (id: number) => void
  onAcknowledge: (id: number) => Promise<void>
}

/** Open alerts (paginated) plus a lazily loaded acknowledged history, for the fleet or a single vehicle. */
export function AlertSection({ vehicleId = null, onSelectVehicle, onAcknowledge }: Props) {
  const scoped = vehicleId !== null
  const [limit, setLimit] = useState<number>(PAGE_SIZE.alerts)
  const [showDone, setShowDone] = useState(false)
  const [doneLimit, setDoneLimit] = useState<number>(PAGE_SIZE.alerts)

  const open = useAlertPage({ vehicleId, acknowledged: false, limit })
  const done = useAlertPage({ vehicleId, acknowledged: true, limit: doneLimit, enabled: showDone })

  const openRows = open.data?.rows ?? []
  const openTotal = open.data?.total ?? 0

  return (
    <div className={`alerts ${scoped ? 'alerts-scoped' : ''}`}>
      {open.error && !open.data && <div className="banner banner-error">Couldn’t load alerts: {open.error}</div>}
      {open.loading && !open.data && <div className="skeleton" />}

      {open.data && openRows.length === 0 && (
        <div className={`empty ${scoped ? 'empty-inline' : ''}`}>
          <Illustration kind="clear" />
          <b>All clear</b>
          <span>{scoped ? 'No open alerts on this vehicle.' : 'Nothing needs attention right now.'}</span>
        </div>
      )}

      <ul className="alert-list">
        {openRows.map((a) => (
          <AlertCard key={a.id} alert={a} showVehicle={!scoped} onSelectVehicle={onSelectVehicle} onAcknowledge={onAcknowledge} />
        ))}
      </ul>
      {openRows.length < openTotal && (
        <button className="more" onClick={() => setLimit((n) => n + PAGE_SIZE.alerts)}>
          Show {Math.min(PAGE_SIZE.alerts, openTotal - openRows.length)} more <span>{openRows.length} of {openTotal}</span>
        </button>
      )}

      <button className="link link-quiet" onClick={() => setShowDone((s) => !s)} aria-expanded={showDone}>
        <Icon name={showDone ? 'chevronDown' : 'chevronRight'} size={13} /> Acknowledged history
      </button>
      {showDone && (
        <>
          {done.loading && !done.data && <div className="skeleton" />}
          {done.data && done.data.rows.length === 0 && <p className="muted small">Nothing acknowledged yet.</p>}
          <ul className="alert-list">
            {(done.data?.rows ?? []).map((a) => (
              <AlertCard key={a.id} alert={a} showVehicle={!scoped} onSelectVehicle={onSelectVehicle} onAcknowledge={onAcknowledge} />
            ))}
          </ul>
          {done.data && done.data.rows.length < done.data.total && (
            <button className="more" onClick={() => setDoneLimit((n) => n + PAGE_SIZE.alerts)}>
              Show more <span>{done.data.rows.length} of {done.data.total}</span>
            </button>
          )}
        </>
      )}
    </div>
  )
}
