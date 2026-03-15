import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

interface NotificationsState {
  instantAlerts: boolean
  emailAlerts: boolean
  dailyDigest: boolean
}

const DEFAULT_PREFS: NotificationsState = {
  instantAlerts: true,
  emailAlerts: true,
  dailyDigest: false,
}

const STORAGE_KEY = 'roof-notification-prefs'

interface NotificationsContextType {
  prefs: NotificationsState
  setPref: (key: keyof NotificationsState, value: boolean) => void
}

const NotificationsContext = createContext<NotificationsContextType>({
  prefs: DEFAULT_PREFS,
  setPref: () => {},
})

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  // Load initial state from localStorage
  const [prefs, setPrefs] = useState<NotificationsState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? { ...DEFAULT_PREFS, ...JSON.parse(stored) } : DEFAULT_PREFS
    } catch {
      return DEFAULT_PREFS
    }
  })

  // Persist to localStorage whenever prefs change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  }, [prefs])

  // Sync prefs to Supabase profile (optional column)
  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .update({ notification_prefs: prefs })
      .eq('id', user.id)
      .then(() => {})
  }, [user, prefs])

  // Load prefs from Supabase on login
  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('notification_prefs')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.notification_prefs) {
          setPrefs((prev) => ({ ...prev, ...(data.notification_prefs as NotificationsState) }))
        }
      })
  }, [user])

  const setPref = useCallback((key: keyof NotificationsState, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }))
  }, [])

  return (
    <NotificationsContext.Provider value={{ prefs, setPref }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  return useContext(NotificationsContext)
}
