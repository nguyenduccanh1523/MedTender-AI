const CACHE_PREFIX = 'medtender:resource:'
const MAX_AGE_MS = 60_000

type CacheEntry = { value: unknown; expiresAt: number }

const values = new Map<string, CacheEntry>()
const pending = new Map<string, Promise<unknown>>()

function storageKey(key: string) { return `${CACHE_PREFIX}${key}` }

function readEntry(key: string) {
  const inMemory = values.get(key)
  if (inMemory) return inMemory
  if (typeof window === 'undefined') return undefined

  try {
    const stored = window.sessionStorage.getItem(storageKey(key))
    if (!stored) return undefined
    const entry = JSON.parse(stored) as CacheEntry
    values.set(key, entry)
    return entry
  } catch {
    return undefined
  }
}

function removeEntry(key: string) {
  values.delete(key)
  if (typeof window !== 'undefined') window.sessionStorage.removeItem(storageKey(key))
}

export function readResource<T>(key: string) {
  const entry = readEntry(key)
  if (!entry) return undefined
  if (entry.expiresAt <= Date.now()) {
    removeEntry(key)
    return undefined
  }
  return entry.value as T
}

export function writeResource<T>(key: string, value: T) {
  const entry = { value, expiresAt: Date.now() + MAX_AGE_MS }
  values.set(key, entry)
  if (typeof window !== 'undefined') {
    try { window.sessionStorage.setItem(storageKey(key), JSON.stringify(entry)) } catch { /* session cache is optional */ }
  }
}

export function loadResource<T>(key: string, loader: () => Promise<T>) {
  const cached = readResource<T>(key)
  if (cached !== undefined) return Promise.resolve(cached)
  const request = pending.get(key) as Promise<T> | undefined
  if (request) return request
  const next = loader().then((value) => { writeResource(key, value); pending.delete(key); return value }).catch((error) => { pending.delete(key); throw error })
  pending.set(key, next)
  return next
}
export function invalidateResource(key: string) { removeEntry(key); pending.delete(key) }
export function clearResources() {
  values.clear()
  pending.clear()
  if (typeof window === 'undefined') return
  for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = window.sessionStorage.key(index)
    if (key?.startsWith(CACHE_PREFIX)) window.sessionStorage.removeItem(key)
  }
}
