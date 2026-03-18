import { Preferences } from '@capacitor/preferences'

/**
 * Drop-in replacement for localStorage backed by @capacitor/preferences.
 * On iOS this writes to NSUserDefaults, which survives app kills unlike
 * WKWebView's localStorage (which iOS can wipe under memory pressure).
 *
 * Two-layer write strategy to prevent the "deleted filter comes back" bug:
 *   - localStorage: synchronous, always reflects the latest state before any kill
 *   - Preferences (NSUserDefaults): async JS bridge, durable across iOS memory wipes
 *
 * On hydrate: load Preferences first (durable), then override with localStorage
 * (more recent — updated synchronously, so it wins if the bridge hadn't flushed yet).
 *
 * Usage:
 *   1. Call `await storage.hydrate()` once at startup (before React renders).
 *   2. Use `storage.getItem / setItem / removeItem` everywhere instead of localStorage.
 */
const cache = new Map<string, string>()

export const storage = {
  /** Load all persisted keys into the in-memory cache. Call once at startup. */
  async hydrate(): Promise<void> {
    // Layer 1: load from Preferences (NSUserDefaults on iOS — survives memory pressure)
    try {
      const { keys } = await Preferences.keys()
      await Promise.all(
        keys.map(async (key) => {
          const { value } = await Preferences.get({ key })
          if (value !== null) cache.set(key, value)
        }),
      )
    } catch {
      // Graceful degradation if Preferences API isn't available
    }

    // Layer 2: override with localStorage values where present.
    // localStorage is written synchronously, so it always reflects the latest
    // state — even if the async Preferences bridge hadn't flushed before a kill.
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key) {
          const value = localStorage.getItem(key)
          if (value !== null) cache.set(key, value)
        }
      }
    } catch {
      // localStorage not available (unlikely but safe to swallow)
    }
  },

  getItem(key: string): string | null {
    return cache.get(key) ?? null
  },

  setItem(key: string, value: string): void {
    cache.set(key, value)
    // Synchronous write: always survives a force-kill
    try { localStorage.setItem(key, value) } catch {}
    // Async write: durable across iOS memory-pressure wipes of localStorage
    Preferences.set({ key, value }).catch(() => {})
  },

  removeItem(key: string): void {
    cache.delete(key)
    try { localStorage.removeItem(key) } catch {}
    Preferences.remove({ key }).catch(() => {})
  },
}
