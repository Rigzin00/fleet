import { useState, type FormEvent } from 'react'
import { demoCredentials, supabase } from '../lib/supabase'
import { Icon, Illustration, LogoMark } from './icons'

/** Decorative: a few routes drawing themselves across a faint grid. */
function LoginArt() {
  return (
    <svg className="login-art" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M48 0H0V48" fill="none" className="art-grid" />
        </pattern>
      </defs>
      <rect width="800" height="600" fill="url(#grid)" />
      <path className="art-route r1" pathLength={1} d="M-20 470C120 470 150 330 280 330S430 430 540 380 650 200 820 170" />
      <path className="art-route r2" pathLength={1} d="M-20 150C90 190 180 120 300 170S470 300 560 250 720 90 820 120" />
      <path className="art-route r3" pathLength={1} d="M120 640C150 520 260 520 330 450S420 250 520 200" />
      <circle className="art-dot d1" cx="540" cy="380" r="6" />
      <circle className="art-dot d2" cx="300" cy="170" r="6" />
      <circle className="art-dot d3" cx="330" cy="450" r="6" />
    </svg>
  )
}

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
      if (error) setError(error.message === 'Invalid login credentials' ? 'That email and password don’t match.' : error.message)
    } catch {
      setError('Couldn’t reach the server. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <LoginArt />
      <form className="login-card" onSubmit={submit} noValidate={false}>
        <div className="brand">
          <LogoMark size={28} />
          Fleetwatch
        </div>
        <div>
          <h1>Welcome back</h1>
          <p className="muted">Sign in to the operations console.</p>
        </div>

        <label>
          Email
          <input type="email" name="email" autoComplete="username" inputMode="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </label>
        <label>
          Password
          <span className="field">
            <input type={show ? 'text' : 'password'} name="password" autoComplete="current-password" required minLength={6} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="field-btn" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
              <Icon name={show ? 'eyeOff' : 'eye'} size={16} />
            </button>
          </span>
        </label>

        {error && <div className="banner banner-error" role="alert">{error}</div>}

        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        {demoCredentials && (
          <button
            type="button"
            className="btn btn-quiet btn-block"
            onClick={() => {
              setEmail(demoCredentials?.email ?? '')
              setPassword(demoCredentials?.password ?? '')
            }}
          >
            Fill demo credentials
          </button>
        )}
      </form>
    </div>
  )
}

export function SetupNotice() {
  return (
    <div className="screen-center">
      <div className="notice">
        <Illustration kind="error" />
        <h1>Supabase isn’t configured</h1>
        <p>
          Copy <code>.env.example</code> to <code>.env</code> and set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then restart the dev server. The README covers the full backend setup.
        </p>
      </div>
    </div>
  )
}
