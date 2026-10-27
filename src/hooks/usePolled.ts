import { useEffect, useRef, useState } from 'react'
import { useInvalidation } from '../lib/invalidate'

interface Options {
  /** Refetch on this interval while the tab is visible. 0 = fetch once per key. */
  intervalMs?: number
  /** Entries with the same group keep showing their previous data while a new key loads. */
  group?: string
  enabled?: boolean
}

interface State<T> {
  key: string
  group: string
  data: T | undefined
  error: string | null
  at: number | null
}

export interface Polled<T> {
  data: T | undefined
  error: string | null
  /** When the data last arrived (ms since epoch). */
  updatedAt: number | null
  /** No data yet for the current key. */
  loading: boolean
  /** Showing the previous key's data while the current one loads. */
  stale: boolean
}

/**
 * Query hook: fetches when `key` changes, optionally polls, refetches on invalidate(),
 * and drops responses that arrive out of order. Background refreshes never flash a loading state.
 */
export function usePolled<T>(fetcher: () => Promise<T>, key: string, { intervalMs = 0, group, enabled = true }: Options = {}): Polled<T> {
  const version = useInvalidation()
  const grp = group ?? key
  const fetcherRef = useRef(fetcher)
  const seq = useRef(0)
  const [state, setState] = useState<State<T>>({ key, group: grp, data: undefined, error: null, at: null })

  useEffect(() => {
    fetcherRef.current = fetcher
  })

  useEffect(() => {
    if (!enabled) return
    let alive = true
    const run = async () => {
      const id = ++seq.current
      try {
        const data = await fetcherRef.current()
        if (alive && id === seq.current) setState({ key, group: grp, data, error: null, at: Date.now() })
      } catch (e) {
        const error = e instanceof Error ? e.message : 'Request failed'
        if (alive && id === seq.current) setState((s) => ({ key, group: grp, data: s.group === grp ? s.data : undefined, error, at: s.group === grp ? s.at : null }))
      }
    }
    run()
    const timer =
      intervalMs > 0
        ? window.setInterval(() => {
            if (document.visibilityState === 'visible') run()
          }, intervalMs)
        : undefined
    return () => {
      alive = false
      if (timer !== undefined) window.clearInterval(timer)
    }
  }, [key, grp, enabled, intervalMs, version])

  const fresh = state.key === key
  const keep = fresh || state.group === grp
  return {
    data: enabled && keep ? state.data : undefined,
    error: enabled && keep ? state.error : null,
    loading: enabled && !(fresh && (state.data !== undefined || state.error !== null)),
    updatedAt: enabled && keep ? state.at : null,
    stale: enabled && !fresh && keep && state.data !== undefined,
  }
}
