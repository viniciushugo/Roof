import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, ReactNode } from 'react'
import { ActiveFilters, DEFAULT_FILTERS } from '../components/ui/FiltersSheet'
import { Listing } from '../data/listings'
import { useListings } from './ListingsContext'
import { supabase } from '../lib/supabase'
import { track } from '../lib/analytics'
import { useAuth } from './AuthContext'
import { storage } from '../lib/storage'

const LOCAL_ALERTS_KEY = 'roof-local-alerts'

function saveAlertsLocally(alerts: Alert[]) {
  storage.setItem(LOCAL_ALERTS_KEY, JSON.stringify(alerts))
}

function loadAlertsLocally(): Alert[] {
  try {
    const raw = storage.getItem(LOCAL_ALERTS_KEY)
    if (raw) return JSON.parse(raw) as Alert[]
  } catch {}
  return []
}

export interface Alert {
  id: string
  name: string
  cities: string[]
  housingType: 'all' | 'room' | 'studio' | 'apartment'
  budgetMin: number
  budgetMax: number
  filters: ActiveFilters
  createdAt: string
  isMain?: boolean
}

export function alertMatchesListing(alert: Alert, l: Listing): boolean {
  if (alert.cities.length > 0 && !alert.cities.includes(l.city)) return false
  if (alert.housingType === 'room' && l.type !== 'Private room' && l.type !== 'Shared room') return false
  if (alert.housingType === 'studio' && l.type !== 'Studio') return false
  if (alert.housingType === 'apartment' && l.type !== 'Apartment') return false
  if (alert.budgetMin > 0 && l.price < alert.budgetMin) return false
  if (alert.budgetMax > 0 && l.price > alert.budgetMax) return false
  const f = alert.filters
  if (f.sizeMin && l.size < parseInt(f.sizeMin)) return false
  if (f.sizeMax && l.size > parseInt(f.sizeMax)) return false
  if (f.rooms.length > 0 && !f.rooms.some((r) => (r === 4 ? l.rooms >= 4 : l.rooms === r))) return false
  if (f.furnished !== 'all' && l.furnished !== f.furnished) return false
  if (f.neighborhoods.length > 0 && !f.neighborhoods.includes(l.neighborhood)) return false
  return true
}

// ─── DB row ↔ Alert conversion ────────────────────────────────────────────────

function rowToAlert(row: Record<string, unknown>): Alert {
  return {
    id: row.id as string,
    name: row.name as string,
    cities: (row.cities as string[]) ?? [],
    housingType: (row.housing_type as Alert['housingType']) ?? 'all',
    budgetMin: (row.budget_min as number) ?? 0,
    budgetMax: (row.budget_max as number) ?? 0,
    filters: ((row.filters as ActiveFilters) ?? DEFAULT_FILTERS),
    createdAt: row.created_at as string,
  }
}

function alertToRow(userId: string, alert: Omit<Alert, 'id' | 'createdAt'>) {
  return {
    user_id: userId,
    name: alert.name,
    cities: alert.cities,
    housing_type: alert.housingType,
    budget_min: alert.budgetMin,
    budget_max: alert.budgetMax,
    filters: alert.filters,
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface AlertsContextType {
  alerts: Alert[]
  addAlert: (data: Omit<Alert, 'id' | 'createdAt'>) => void
  updateAlert: (id: string, data: Partial<Omit<Alert, 'id' | 'createdAt'>>) => void
  removeAlert: (id: string) => void
  unreadCount: number
  markAllRead: () => void
}

const AlertsContext = createContext<AlertsContextType>({
  alerts: [],
  addAlert: () => {},
  updateAlert: () => {},
  removeAlert: () => {},
  unreadCount: 0,
  markAllRead: () => {},
})

export function AlertsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { listings } = useListings()
  // Seed from local cache immediately so UI shows correct state before network
  const [alerts, setAlertsRaw] = useState<Alert[]>(() => loadAlertsLocally())
  const [seenIds, setSeenIds] = useState<ReadonlySet<string>>(new Set())

  // Track IDs with pending deletes so loadAlerts() doesn't re-insert them
  const pendingDeletes = useRef(new Set<string>())

  // Wrap setAlerts so every write also persists locally
  const setAlerts = useCallback((updater: Alert[] | ((prev: Alert[]) => Alert[])) => {
    setAlertsRaw((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      saveAlertsLocally(next)
      return next
    })
  }, [])

  // Load alerts from Supabase
  const loadAlerts = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('alerts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    if (data) {
      // Filter out any alerts that are being deleted — prevents the race condition
      // where a re-fetch arrives before the DELETE has committed to the DB.
      const mapped = data
        .filter((row) => !pendingDeletes.current.has(row.id as string))
        .map(rowToAlert)
      if (mapped.length > 0) mapped[0].isMain = true
      setAlerts(mapped)
    }
  }, [user, setAlerts])

  // Load alerts on mount and when user changes
  useEffect(() => {
    if (!user) return  // keep local cache — don't wipe on auth delay
    loadAlerts()
  }, [user, loadAlerts])

  // Reload alerts when app returns from background
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && user) loadAlerts()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [user, loadAlerts])

  const addAlert = useCallback((data: Omit<Alert, 'id' | 'createdAt'>) => {
    track('alert_created', {
      name: data.name,
      cities: data.cities,
      housing_type: data.housingType,
      budget_min: data.budgetMin,
      budget_max: data.budgetMax,
    })
    if (user) {
      supabase
        .from('alerts')
        .insert(alertToRow(user.id, data))
        .select()
        .single()
        .then(({ data: row }) => {
          if (row) setAlerts((prev) => {
            const alert = rowToAlert(row)
            // First alert becomes the main alert
            if (prev.length === 0) alert.isMain = true
            return [...prev, alert]
          })
        })
    } else {
      setAlerts((prev) => {
        const alert: Alert = { ...data, id: Date.now().toString(), createdAt: new Date().toISOString() }
        if (prev.length === 0) alert.isMain = true
        return [...prev, alert]
      })
    }
  }, [user, setAlerts])

  const updateAlert = useCallback(async (id: string, data: Partial<Omit<Alert, 'id' | 'createdAt'>>) => {
    setAlerts((prev) => prev.map((a) => {
      if (a.id !== id) return a
      const { isMain: _, ...safeData } = data as Partial<Alert>
      return { ...a, ...safeData }
    }))
    if (user) {
      const dbData: Record<string, unknown> = {}
      if (data.name !== undefined) dbData.name = data.name
      if (data.cities !== undefined) dbData.cities = data.cities
      if (data.housingType !== undefined) dbData.housing_type = data.housingType
      if (data.budgetMin !== undefined) dbData.budget_min = data.budgetMin
      if (data.budgetMax !== undefined) dbData.budget_max = data.budgetMax
      if (data.filters !== undefined) dbData.filters = data.filters
      await supabase.from('alerts').update(dbData).eq('id', id)
    }
  }, [user, setAlerts])

  const removeAlert = useCallback(async (id: string) => {
    // Check locally first — can't delete the main alert
    setAlertsRaw((prev) => {
      const target = prev.find((a) => a.id === id)
      if (target?.isMain) return prev
      return prev // just for the check — actual removal below
    })
    // Re-read to check isMain without stale closure
    const isMain = alerts.find((a) => a.id === id)?.isMain
    if (isMain) return

    // Mark as pending delete so loadAlerts() won't re-insert it
    pendingDeletes.current.add(id)

    // Optimistic local update (immediate UI feedback)
    setAlerts((prev) => prev.filter((a) => a.id !== id))

    // Await the DB delete so Supabase is consistent before any re-fetch
    if (user) {
      const { error } = await supabase.from('alerts').delete().eq('id', id)
      if (error) {
        // DB delete failed — roll back
        pendingDeletes.current.delete(id)
        loadAlerts() // re-fetch clean state from DB
      } else {
        // Delete succeeded — safe to stop blocking re-fetches
        pendingDeletes.current.delete(id)
      }
    } else {
      pendingDeletes.current.delete(id)
    }
  }, [user, alerts, setAlerts, loadAlerts])

  const newMatchIds = useMemo(() => {
    const ids = new Set<string>()
    alerts.forEach((alert) => {
      listings
        .filter((l) => l.isNew && alertMatchesListing(alert, l))
        .forEach((l) => ids.add(l.id))
    })
    return ids
  }, [alerts, listings])

  const unreadCount = useMemo(() => {
    let count = 0
    newMatchIds.forEach((id) => { if (!seenIds.has(id)) count++ })
    return count
  }, [newMatchIds, seenIds])

  const markAllRead = useCallback(() => {
    setSeenIds((prev) => {
      const next = new Set(prev)
      newMatchIds.forEach((id) => next.add(id))
      return next
    })
  }, [newMatchIds])

  return (
    <AlertsContext.Provider value={{ alerts, addAlert, updateAlert, removeAlert, unreadCount, markAllRead }}>
      {children}
    </AlertsContext.Provider>
  )
}

export function useAlerts() {
  return useContext(AlertsContext)
}

export { DEFAULT_FILTERS }
