import { useState, useEffect } from 'react'

/**
 * Tracks network connectivity. Uses Capacitor Network plugin on iOS,
 * falls back to navigator.onLine + event listeners for web.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    let cleanup: (() => void) | undefined
    let cancelled = false

    async function init() {
      try {
        const { Network } = await import('@capacitor/network')
        if (cancelled) {
          return
        }

        const status = await Network.getStatus()
        if (cancelled) {
          return
        }

        setIsOnline(status.connected)

        const handle = await Network.addListener('networkStatusChange', (s) => {
          if (!cancelled) {
            setIsOnline(s.connected)
          }
        })

        if (cancelled) {
          // Component unmounted while adding listener; remove it immediately.
          await handle.remove()
          return
        }

        cleanup = () => {
          handle.remove()
        }
      } catch {
        // Fallback for web (non-Capacitor environments)
        if (cancelled) {
          return
        }

        setIsOnline(navigator.onLine)

        const onOnline = () => {
          if (!cancelled) {
            setIsOnline(true)
          }
        }

        const onOffline = () => {
          if (!cancelled) {
            setIsOnline(false)
          }
        }

        window.addEventListener('online', onOnline)
        window.addEventListener('offline', onOffline)

        if (cancelled) {
          // Component unmounted while adding listeners; remove them immediately.
          window.removeEventListener('online', onOnline)
          window.removeEventListener('offline', onOffline)
          return
        }

        cleanup = () => {
          window.removeEventListener('online', onOnline)
          window.removeEventListener('offline', onOffline)
        }
      }
    }

    void init()

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [])

  return isOnline
}
