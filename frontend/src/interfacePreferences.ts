import { useSyncExternalStore } from 'react'

const key = 'aniq-reduce-motion'
const eventName = 'aniq:interface-preferences'
let fallback = false
let memoryOnly = false

function getSnapshot() {
  if (memoryOnly) return fallback
  try {
    return localStorage.getItem(key) === 'true'
  } catch {
    return fallback
  }
}
function subscribe(notify: () => void) {
  const changed = (event: StorageEvent) => {
    if (event.key === key || event.key === null) notify()
  }
  window.addEventListener(eventName, notify)
  window.addEventListener('storage', changed)
  return () => {
    window.removeEventListener(eventName, notify)
    window.removeEventListener('storage', changed)
  }
}
function setReduceMotion(value: boolean) {
  fallback = value
  try {
    localStorage.setItem(key, String(value))
    memoryOnly = false
  } catch {
    memoryOnly = true
  }
  window.dispatchEvent(new Event(eventName))
}
export function useInterfacePreferences() {
  return {
    reduceMotion: useSyncExternalStore(subscribe, getSnapshot, () => false),
    setReduceMotion,
  }
}
