import { useEffect, useRef, useState } from 'react'
import { Icon } from './icons'

const SHORTCUTS: [string, string][] = [
  ['/', 'Search vehicles'],
  ['J / K', 'Next / previous vehicle'],
  ['1 / 2', 'Vehicles / Alerts'],
  ['Esc', 'Close details'],
]

export function AccountMenu({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  return (
    <div className="menu" ref={root}>
      <button className="avatar" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu">
        {(email[0] ?? '?').toUpperCase()}
      </button>
      {open && (
        <div className="menu-pop" role="menu">
          <div className="menu-email" title={email}>{email}</div>
          <div className="menu-sep" />
          <div className="menu-title">
            <Icon name="keyboard" size={14} /> Shortcuts
          </div>
          <dl className="shortcuts">
            {SHORTCUTS.map(([k, d]) => (
              <div key={k}>
                <dt>
                  {k.split(' / ').map((key) => (
                    <kbd key={key}>{key}</kbd>
                  ))}
                </dt>
                <dd>{d}</dd>
              </div>
            ))}
          </dl>
          <div className="menu-sep" />
          <button className="menu-item" role="menuitem" onClick={onSignOut}>
            <Icon name="signout" size={15} /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}
