import { useSyncExternalStore } from 'react'

// A tiny "something changed on the server" signal. Mutations call invalidate(); every data hook
// refetches in the background, so a list, a badge and the map all agree right after a write.

let version = 0
const listeners = new Set<() => void>()

export function invalidate() {
  version++
  listeners.forEach((l) => l())
}

export const useInvalidation = () =>
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => version,
  )
