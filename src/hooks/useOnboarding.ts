import { useState, useCallback } from 'react'

const STORAGE_KEY = 'roof-onboarding-complete'

export function useOnboarding() {
  const [showTour, setShowTour] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'true'
    } catch {
      return false
    }
  })

  const completeTour = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, 'true') } catch {}
    setShowTour(false)
  }, [])

  const skipTour = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, 'true') } catch {}
    setShowTour(false)
  }, [])

  return { showTour, completeTour, skipTour }
}
