import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

function isHttpUrl(value: string | undefined): value is string {
  try {
    const { protocol } = new URL(value ?? '')
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

export const isConfigured = isHttpUrl(url) && Boolean(anonKey)

const REQUEST_TIMEOUT_MS = 15_000

// Every request gets a deadline, so a stalled connection becomes an error the UI can show
// rather than a spinner that never ends.
const fetchWithTimeout: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS) })

// A placeholder URL keeps createClient from throwing when the env is missing;
// <App /> renders a setup screen in that case and never makes a request.
export const supabase = createClient(
  isConfigured ? (url as string) : 'http://localhost:54321',
  anonKey ?? 'missing-anon-key',
  { global: { fetch: fetchWithTimeout } },
)

export const demoCredentials =
  import.meta.env.VITE_DEMO_EMAIL && import.meta.env.VITE_DEMO_PASSWORD
    ? { email: import.meta.env.VITE_DEMO_EMAIL as string, password: import.meta.env.VITE_DEMO_PASSWORD as string }
    : null
