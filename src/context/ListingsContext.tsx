import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { Listing } from '../data/listings'

interface ListingsContextType {
  listings: Listing[]
  loading: boolean
  refreshing: boolean
  refresh: () => Promise<boolean>
  newCount: number
  clearNewCount: () => void
}

const ListingsContext = createContext<ListingsContextType>({
  listings: [],
  loading: true,
  refreshing: false,
  refresh: async () => true,
  newCount: 0,
  clearNewCount: () => {},
})

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// Map Supabase DB row → app Listing shape
function isRecent(iso: string, hours = 24): boolean {
  return Date.now() - new Date(iso).getTime() < hours * 60 * 60 * 1000
}

function parseImages(row: Record<string, unknown>): string[] {
  // Try the dedicated images JSON column first
  if (row.images) {
    try {
      const parsed = typeof row.images === 'string' ? JSON.parse(row.images) : row.images
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as string[]
    } catch { /* fall through */ }
  }
  // Fallback: wrap the single image_url into an array
  const single = (row.image_url as string) || ''
  return single ? [single] : []
}

function rowToListing(row: Record<string, unknown>): Listing {
  const createdAt = (row.created_at as string) ?? (row.first_seen_at as string) ?? (row.last_seen_at as string) ?? new Date().toISOString()
  return {
    id: row.id as string,
    title: row.title as string,
    neighborhood: (row.neighborhood as string) ?? '',
    city: row.city as string,
    price: row.price as number,
    type: (row.type as Listing['type']) ?? 'Apartment',
    size: (row.size as number) ?? 0,
    rooms: (row.rooms as number) ?? 0,
    furnished: (row.furnished as Listing['furnished']) ?? 'furnished',
    source: (row.source as Listing['source']) ?? 'Pararius',
    url: row.url as string,
    image: (row.image_url as string) || '',
    images: parseImages(row),
    availableFrom: (row.available_from as string) ?? '',
    isNew: isRecent(createdAt, 24),
    postedAt: relativeTime(createdAt),
    postedAtRaw: createdAt,
    description: (row.description as string) ?? '',
  }
}

/**
 * Interleave listings so sources are blended rather than clustered.
 * Groups by 6-hour time window, then round-robins sources within each window.
 */
function blendListings(rows: Listing[]): Listing[] {
  const WINDOW_MS = 6 * 60 * 60 * 1000 // 6 hours
  // Group into time windows
  const windows = new Map<number, Listing[]>()
  for (const r of rows) {
    const t = new Date(r.postedAtRaw).getTime()
    const bucket = Math.floor(t / WINDOW_MS)
    if (!windows.has(bucket)) windows.set(bucket, [])
    windows.get(bucket)!.push(r)
  }

  const result: Listing[] = []
  // Process windows newest first
  const sortedBuckets = [...windows.keys()].sort((a, b) => b - a)
  for (const bucket of sortedBuckets) {
    const group = windows.get(bucket)!
    // Round-robin by source within this window
    const bySource = new Map<string, Listing[]>()
    for (const l of group) {
      if (!bySource.has(l.source)) bySource.set(l.source, [])
      bySource.get(l.source)!.push(l)
    }
    const sources = [...bySource.keys()]
    let added = true
    while (added) {
      added = false
      for (const src of sources) {
        const arr = bySource.get(src)!
        if (arr.length > 0) {
          result.push(arr.shift()!)
          added = true
        }
      }
    }
  }
  return result
}

async function fetchFromSupabase(): Promise<Listing[]> {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (data && !error) {
    const listings = data.map(rowToListing)
    return blendListings(listings)
  }
  return []
}

export function ListingsProvider({ children }: { children: ReactNode }) {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [newCount, setNewCount] = useState(0)
  const knownIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    fetchFromSupabase().then((data) => {
      setListings(data)
      data.forEach((l) => knownIds.current.add(l.id))
      setLoading(false)
    })

    // Subscribe to new listings via Supabase Realtime
    const channel = supabase
      .channel('listings-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'listings' },
        (payload) => {
          const newListing = rowToListing(payload.new as Record<string, unknown>)
          if (!knownIds.current.has(newListing.id)) {
            knownIds.current.add(newListing.id)
            setListings((prev) => [newListing, ...prev])
            setNewCount((prev) => prev + 1)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const refresh = useCallback(async (): Promise<boolean> => {
    setRefreshing(true)
    // Trigger scrapers in the background (fire & forget)
    supabase.functions.invoke('trigger-scrape').catch(() => {})
    // Immediately re-fetch current listings from DB
    try {
      const data = await fetchFromSupabase()
      setListings(data)
      // Rebuild the known IDs set to match the latest data
      knownIds.current = new Set(data.map((l) => l.id))
      return true
    } catch {
      return false
    } finally {
      setRefreshing(false)
    }
  }, [])

  const clearNewCount = useCallback(() => setNewCount(0), [])

  return (
    <ListingsContext.Provider value={{ listings, loading, refreshing, refresh, newCount, clearNewCount }}>
      {children}
    </ListingsContext.Provider>
  )
}

export function useListings() {
  return useContext(ListingsContext)
}
