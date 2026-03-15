import { useEffect, useRef, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'

/**
 * Manages push notification registration on iOS.
 *
 * - Requests permission when instantAlerts is enabled
 * - Stores device token in Supabase `push_tokens` table
 * - Removes token when instantAlerts is disabled or user signs out
 * - Handles incoming push notifications (foreground tap → navigate)
 */
export function usePushNotifications(onOpenListing?: (listingId: string) => void) {
  const { user } = useAuth()
  const { prefs } = useNotifications()
  const tokenRef = useRef<string | null>(null)

  // Upsert the token to Supabase
  const saveToken = useCallback(
    async (token: string) => {
      if (!user) return
      tokenRef.current = token

      await supabase.from('push_tokens').upsert(
        {
          user_id: user.id,
          token,
          platform: 'ios',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,token' },
      )
    },
    [user],
  )

  // Remove token from Supabase
  const removeToken = useCallback(async () => {
    if (!user || !tokenRef.current) return
    await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', user.id)
      .eq('token', tokenRef.current)
    tokenRef.current = null
  }, [user])

  useEffect(() => {
    // Only on native iOS
    if (!Capacitor.isNativePlatform()) return
    if (!user) return

    // If the user has disabled instant alerts, remove token
    if (!prefs.instantAlerts) {
      removeToken()
      return
    }

    let isMounted = true

    const register = async () => {
      // Check / request permission
      let permStatus = await PushNotifications.checkPermissions()

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions()
      }

      if (permStatus.receive !== 'granted') {
        console.log('[Push] Permission not granted:', permStatus.receive)
        return
      }

      // Listen for registration success
      PushNotifications.addListener('registration', (token) => {
        if (isMounted) {
          console.log('[Push] Token:', token.value)
          saveToken(token.value)
        }
      })

      // Listen for registration error
      PushNotifications.addListener('registrationError', (err) => {
        console.error('[Push] Registration error:', err.error)
      })

      // Handle foreground notifications
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[Push] Foreground:', notification.title)
        // Could show an in-app toast here
      })

      // Handle notification tap (app was in background)
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const listingId = action.notification.data?.listing_id
        if (listingId && onOpenListing) {
          onOpenListing(listingId)
        }
      })

      // Trigger registration
      await PushNotifications.register()
    }

    register()

    return () => {
      isMounted = false
      PushNotifications.removeAllListeners()
    }
  }, [user, prefs.instantAlerts, saveToken, removeToken, onOpenListing])

  return { removeToken }
}
