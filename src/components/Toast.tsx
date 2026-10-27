import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon } from './icons'

interface ToastInput {
  message: string
  tone?: 'default' | 'error'
  action?: { label: string; onClick: () => void }
  durationMs?: number
}
interface ToastItem extends ToastInput {
  id: number
}

const ToastContext = createContext<(t: ToastInput) => void>(() => {})
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), [])
  const push = useCallback((t: ToastInput) => {
    const id = nextId.current++
    setItems((list) => [...list.slice(-2), { ...t, id }])
  }, [])
  const value = useMemo(() => push, [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="region" aria-label="Notifications" aria-live="polite">
        {items.map((t) => (
          <ToastView key={t.id} item={t} onDone={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastView({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const [paused, setPaused] = useState(false)
  const duration = item.durationMs ?? (item.action ? 7000 : 4000)

  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  })
  useEffect(() => {
    if (paused) return
    const id = window.setTimeout(() => doneRef.current(), duration)
    return () => window.clearTimeout(id)
  }, [paused, duration])

  return (
    <div
      className={`toast ${item.tone === 'error' ? 'toast-error' : ''}`}
      role={item.tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span>{item.message}</span>
      {item.action && (
        <button
          className="toast-action"
          onClick={() => {
            item.action?.onClick()
            onDone()
          }}
        >
          <Icon name="undo" size={14} /> {item.action.label}
        </button>
      )}
      <button className="toast-close" onClick={onDone} aria-label="Dismiss">
        <Icon name="close" size={14} />
      </button>
      {!paused && <i className="toast-timer" style={{ animationDuration: `${duration}ms` }} />}
    </div>
  )
}
