import { useEffect } from 'react'
import { useSaved } from '../context/SavedContext'

const RATING_KEY = 'roof-rating-prompted'
const SAVE_THRESHOLD = 5

export function useAppRating() {
  const { savedIds } = useSaved()

  useEffect(() => {
    if (savedIds.size < SAVE_THRESHOLD) return
    if (localStorage.getItem(RATING_KEY)) return

    localStorage.setItem(RATING_KEY, 'true')

    // Use a short delay so it doesn't interrupt the save action
    const timer = setTimeout(() => {
      try {
        // Try native-like rating prompt via Capacitor plugin if available
        // Falls back to a simple confirm dialog for web
        const shouldRate = window.confirm(
          'Enjoying Roof? We\'d love your feedback! Would you like to rate the app?'
        )
        if (shouldRate) {
          // On iOS/Android this would open the App Store / Play Store page
          // For web, we can open a feedback URL or just acknowledge
          // Replace with actual store URL when available
          window.open('https://apps.apple.com/app/roof', '_blank')
        }
      } catch {
        // Silently fail if anything goes wrong
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [savedIds.size])
}
