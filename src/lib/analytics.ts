import { supabase } from './supabase'

/**
 * Lightweight analytics — fire-and-forget event tracking to Supabase.
 * Errors are silently swallowed so tracking never blocks the UI.
 */
export function track(event: string, properties?: Record<string, unknown>) {
  // Run async but don't await — non-blocking
  ;(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user_id = session?.user?.id ?? null

      await supabase.from('analytics_events').insert({
        user_id,
        event,
        properties: properties ?? {},
      })
    } catch {
      // Silently ignore — analytics should never break the app
    }
  })()
}
