import { useCallback, useSyncExternalStore } from 'react'
import { parseId } from '../lib/sanitize'

export interface Route {
  vehicle: number | null
  trip: number | null
}

// The selected vehicle/trip live in the URL hash (#/v/3/t/45) so a reload or shared link restores the view.
// The hash is untrusted input: ids are parsed strictly and anything else is ignored.

function parse(hash: string): Route {
  const m = /^#\/v\/(\d+)(?:\/t\/(\d+))?\/?$/.exec(hash)
  const vehicle = parseId(m?.[1])
  return vehicle === null ? { vehicle: null, trip: null } : { vehicle, trip: parseId(m?.[2]) }
}

function subscribe(fn: () => void) {
  window.addEventListener('hashchange', fn)
  return () => window.removeEventListener('hashchange', fn)
}
const snapshot = () => window.location.hash

export function useRoute(): [Route, (next: Route, opts?: { replace?: boolean }) => void] {
  const hash = useSyncExternalStore(subscribe, snapshot)
  const navigate = useCallback((next: Route, opts?: { replace?: boolean }) => {
    const target = next.vehicle === null ? '#/' : `#/v/${next.vehicle}${next.trip !== null ? `/t/${next.trip}` : ''}`
    if (opts?.replace) {
      history.replaceState(null, '', target)
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    } else {
      window.location.hash = target
    }
  }, [])
  return [parse(hash), navigate]
}
