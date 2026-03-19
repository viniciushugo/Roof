import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { useSaved } from '../context/SavedContext'
import { storage } from '../lib/storage'

const RATING_KEY = 'roof-rating-prompted'
const SAVE_THRESHOLD = 5

export function useAppRating() {
  const { savedIds } = useSaved()

  useEffect(() => {
    if (savedIds.size < SAVE_THRESHOLD) return
    if (storage.getItem(RATING_KEY)) return

    storage.setItem(RATING_KEY, 'true')

    const timer = setTimeout(async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          // Use native SKStoreReviewController on iOS
          const { RateApp } = await import('capacitor-rate-app')
          await RateApp.requestReview()
        } else {
          // Web fallback — navigate to App Store directly
          window.location.href = 'https://apps.apple.com/app/roof'
        }
      } catch {
        // Silently fail — rating prompt is non-critical
      }
    }, 1500)

    return () => clearTimeout(timer)
  }, [savedIds.size])
}
