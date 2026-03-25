/**
 * Client-side geocoding service for Dutch rental listings.
 *
 * Uses OpenStreetMap Nominatim with aggressive localStorage caching.
 * Rate-limited to 1 req/sec per Nominatim's usage policy.
 *
 * For production: geocoding should happen server-side during scraping,
 * with lat/lng stored in the database. This client-side approach is a
 * progressive enhancement for the current architecture.
 */

interface GeoResult {
  lat: number
  lng: number
}

const CACHE_KEY = 'roof-geocache-v1'
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const RATE_MS = 1100

// ── Persistent localStorage cache ─────────────────────────────────────────
let cache: Record<string, GeoResult> = {}
try {
  cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
} catch {
  cache = {}
}

function persistCache() {
  try {
    const keys = Object.keys(cache)
    if (keys.length > 5000) {
      const trimmed: Record<string, GeoResult> = {}
      keys.slice(-5000).forEach((k) => (trimmed[k] = cache[k]))
      cache = trimmed
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch { /* localStorage full */ }
}

// ── Public API ────────────────────────────────────────────────────────────
export function getCached(key: string): GeoResult | undefined {
  return cache[key]
}

export function buildQuery(city: string, neighborhood: string): { key: string; query: string } {
  const c = city.trim()
  const n = neighborhood.trim()
  const key = n ? `${c}|${n}` : c

  // Dutch postal code (4 digits + 2 letters)
  const postal = n.match(/(\d{4})\s?([A-Z]{2})/)
  if (postal) return { key, query: `${postal[1]}${postal[2]}, ${c}, Netherlands` }

  // Parenthesized neighborhood
  const paren = n.match(/\(([^)]+)\)/)
  if (paren) return { key, query: `${paren[1]}, ${c}, Netherlands` }

  // Non-empty neighborhood — use as street/area name
  if (n.length > 1) return { key, query: `${n}, ${c}, Netherlands` }

  return { key, query: `${c}, Netherlands` }
}

/**
 * Batch-geocode listings with progressive callbacks.
 * Deduplicates by cache key. Cached items resolve synchronously.
 * Uncached items are fetched sequentially at 1 req/sec.
 */
export async function batchGeocode(
  items: Array<{ id: string; city: string; neighborhood: string }>,
  onResult: (id: string, coords: GeoResult) => void,
  signal?: AbortSignal,
): Promise<void> {
  const byKey = new Map<string, string[]>()
  const queries = new Map<string, string>()

  for (const item of items) {
    const { key, query } = buildQuery(item.city, item.neighborhood)
    if (!byKey.has(key)) {
      byKey.set(key, [])
      queries.set(key, query)
    }
    byKey.get(key)!.push(item.id)
  }

  // Phase 1: Resolve cached items immediately
  const uncached: string[] = []
  for (const [key, ids] of byKey) {
    if (cache[key]) {
      ids.forEach((id) => onResult(id, cache[key]))
    } else {
      uncached.push(key)
    }
  }

  // Phase 2: Fetch uncached from Nominatim
  for (let i = 0; i < uncached.length; i++) {
    if (signal?.aborted) return

    const key = uncached[i]
    const query = queries.get(key)!

    if (cache[key]) {
      byKey.get(key)!.forEach((id) => onResult(id, cache[key]))
      continue
    }

    try {
      const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&countrycodes=nl&format=json&limit=1`
      const res = await fetch(url, { signal })
      if (!res.ok) continue
      const data = await res.json()

      if (data?.[0]) {
        const result: GeoResult = {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        }
        cache[key] = result
        persistCache()

        if (!signal?.aborted) {
          byKey.get(key)!.forEach((id) => onResult(id, result))
        }
      }
    } catch {
      if (signal?.aborted) return
    }

    // Rate limit
    if (i < uncached.length - 1 && !signal?.aborted) {
      await new Promise<void>((r) => {
        const timer = setTimeout(r, RATE_MS)
        signal?.addEventListener('abort', () => { clearTimeout(timer); r() }, { once: true })
      })
    }
  }
}
