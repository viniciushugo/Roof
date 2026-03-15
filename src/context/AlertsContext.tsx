import { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react'
import { ActiveFilters, DEFAULT_FILTERS } from '../components/ui/FiltersSheet'
import { listings, Listing } from '../data/listings'
import { supabase } from '../lib/supabase'
import { track } from '../lib/analytics'
import { useAuth } from './AuthContext'

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
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [seenIds, setSeenIds] = useState<ReadonlySet<string>>(new Set())

  // Load alerts from Supabase
  const loadAlerts = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('alerts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    if (data) {
      const mapped = data.map(rowToAlert)
      if (mapped.length > 0) mapped[0].isMain = true
      setAlerts(mapped)
    }
  }, [user])

  // Load alerts on mount and when user changes
  useEffect(() => {
    if (!user) { setAlerts([]); return }
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
  }, [user])

  const updateAlert = useCallback((id: string, data: Partial<Omit<Alert, 'id' | 'createdAt'>>) => {
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
      supabase.from('alerts').update(dbData).eq('id', id).then(() => {})
    }
  }, [user])

  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => {
      const target = prev.find((a) => a.id === id)
      if (target?.isMain) return prev // Can't delete main alert
      return prev.filter((a) => a.id !== id)
    })
    if (user) {
      supabase.from('alerts').delete().eq('id', id)
    }
  }, [user])

  const newMatchIds = useMemo(() => {
    const ids = new Set<string>()
    alerts.forEach((alert) => {
      listings
        .filter((l) => l.isNew && alertMatchesListing(alert, l))
        .forEach((l) => ids.add(l.id))
    })
    return ids
  }, [alerts])

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
