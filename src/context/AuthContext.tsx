import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { Browser } from '@capacitor/browser'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { supabase } from '../lib/supabase'
import { identifyUser, resetUser, trackEvent } from '../lib/amplitude'

async function sendWelcomeEmail(email: string, name: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.functions.invoke('send-welcome-email', {
      body: { email, name },
      headers: session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {},
    })
  } catch {
    // Non-blocking — email failure should never break signup
  }
}

interface AuthContextType {
  session: Session | null
  user: User | null
  loading: boolean
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signInWithGoogle: () => Promise<{ error: string | null }>
  signInWithApple: () => Promise<{ error: string | null }>
  deleteAccount: () => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signUp: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
  signInWithGoogle: async () => ({ error: null }),
  signInWithApple: async () => ({ error: null }),
  deleteAccount: async () => ({ error: null }),
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fast path: if we just came back from an OAuth reload, redirect immediately
    // without waiting for the async Supabase session load. The destination was
    // computed BEFORE the reload so no network queries are needed here.
    const oauthRedirect = localStorage.getItem('roof-oauth-redirect')
    if (oauthRedirect) {
      localStorage.removeItem('roof-oauth-redirect')
      window.location.replace(oauthRedirect)
      return // skip everything else — page is navigating away
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        identifyUser(session.user.id, { 
          email: session.user.email, 
          name: session.user.user_metadata?.name 
        })
      }
      // Don't resolve loading if an OAuth fragment is pending — wait for onAuthStateChange
      const hasOAuthFragment = window.location.hash.includes('access_token')
      if (!hasOAuthFragment) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        identifyUser(session.user.id, { 
          email: session.user.email, 
          name: session.user.user_metadata?.name 
        })
      } else {
        resetUser()
      }

      if (_event === 'SIGNED_IN') {
        trackEvent('login_completed')
        setLoading(false)
      } else if (_event === 'TOKEN_REFRESHED' || _event === 'INITIAL_SESSION') {
        setLoading(false)
      }
    })

    // Re-check session when app returns from background (Capacitor)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().then(({ data: { session } }) => {
          setSession(session)
        })
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // ─── iOS native: handle OAuth deep-link callback ───────────────────────
    // When Google OAuth completes on iOS, the system calls back to
    // com.hugovinicius.roof://app/rooms?code=XXX (PKCE) or #access_token=XXX (implicit)
    // @capacitor/browser (SFSafariViewController) is still open at this point,
    // so we close it, exchange the code/tokens, and set the Supabase session.
    let urlListener: { remove: () => void } | null = null

    const isNative = Capacitor.isNativePlatform()
    if (isNative) {
      CapacitorApp.addListener('appUrlOpen', async ({ url }: { url: string }) => {
        // Only handle URLs that look like OAuth callbacks
        if (!url.includes('code=') && !url.includes('access_token') && !url.includes('refresh_token')) return

        // Close the SFSafariViewController
        await Browser.close().catch(() => {})

        let sessionOk = false

        // Try PKCE flow first (code in query string)
        const queryPart = url.includes('?') ? url.split('?')[1]?.split('#')[0] ?? '' : ''
        const queryParams = new URLSearchParams(queryPart)
        const code = queryParams.get('code')

        if (code) {
          try {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code)
            sessionOk = !error && !!data.session
          } catch { /* exchange failed — fall through */ }
        }

        // Fallback: implicit flow (tokens in URL fragment)
        if (!sessionOk) {
          const hashPart = url.includes('#') ? url.split('#')[1] : ''
          const hashParams = new URLSearchParams(hashPart)
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')
          if (accessToken && refreshToken) {
            try {
              const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
              sessionOk = !error && !!data.session
            } catch { /* setSession failed */ }
          }
        }

        if (sessionOk) {
          // Determine destination BEFORE reload so we don't need async DB queries after.
          const fromOnboarding = window.location.pathname.includes('/onboarding')
          if (fromOnboarding) {
            localStorage.setItem('roof-oauth-redirect', '/onboarding/housing-type')
          } else {
            // Check if brand-new user by created_at (within last 60 seconds = just signed up)
            const { data: { session: s } } = await supabase.auth.getSession()
            const createdAt = s?.user?.created_at ? new Date(s.user.created_at).getTime() : 0
            const isNewUser = Date.now() - createdAt < 60_000
            localStorage.setItem('roof-oauth-redirect', isNewUser ? '/onboarding/name' : '/app/rooms')
          }
          // React setState from Capacitor native events doesn't reliably trigger
          // re-renders, so a full page reload is the only way to guarantee the UI updates.
          window.location.reload()
        }
      }).then(listener => { urlListener = listener })
    }

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      urlListener?.remove()
    }
  }, [])

  const signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })
    if (!error && data.user) {
      sendWelcomeEmail(email, name)
    }
    return { error: error?.message ?? null }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signInWithGoogle = async () => {
    const isNative = Capacitor.isNativePlatform()

    if (isNative) {
      // ── iOS / Android native ────────────────────────────────────────────────
      // Skip the auto-redirect so the WKWebView doesn't navigate away and lose
      // JavaScript context. Instead, open the OAuth URL in SFSafariViewController
      // (a separate system browser). The callback deep-link is caught above by
      // the appUrlOpen listener, which closes the browser and sets the session.
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'com.hugovinicius.roof://app/rooms',
          skipBrowserRedirect: true,
        },
      })
      if (error) {
        const msg = error.message || ''
        if (msg.includes('provider') || msg.includes('not enabled') || msg.includes('Unsupported')) {
          return { error: 'Google sign-in is not yet configured. Enable the Google provider in the Supabase Dashboard under Authentication → Providers.' }
        }
        return { error: msg }
      }
      if (data?.url) {
        await Browser.open({ url: data.url, windowName: '_self' })
      }
      return { error: null }
    } else {
      // ── Web ─────────────────────────────────────────────────────────────────
      // Standard browser redirect. Supabase redirects to Google, then back to
      // the current origin so detectSessionInUrl picks up the access_token hash.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/app/rooms` },
      })
      if (error) {
        const msg = error.message || ''
        if (msg.includes('provider') || msg.includes('not enabled') || msg.includes('Unsupported')) {
          return { error: 'Google sign-in is not yet configured. Enable the Google provider in the Supabase Dashboard under Authentication → Providers.' }
        }
        return { error: msg }
      }
      return { error: null }
    }
  }

  const signInWithApple = async () => {
    const isNative = Capacitor.isNativePlatform()

    if (isNative) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: 'com.hugovinicius.roof://app/rooms',
          skipBrowserRedirect: true,
        },
      })
      if (error) {
        const msg = error.message || ''
        if (msg.includes('provider') || msg.includes('not enabled') || msg.includes('Unsupported')) {
          return { error: 'Apple sign-in is not yet configured. Enable the Apple provider in the Supabase Dashboard under Authentication → Providers.' }
        }
        return { error: msg }
      }
      if (data?.url) {
        await Browser.open({ url: data.url, windowName: '_self' })
      }
      return { error: null }
    } else {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: { redirectTo: `${window.location.origin}/app/rooms` },
      })
      if (error) {
        const msg = error.message || ''
        if (msg.includes('provider') || msg.includes('not enabled') || msg.includes('Unsupported')) {
          return { error: 'Apple sign-in is not yet configured. Enable the Apple provider in the Supabase Dashboard under Authentication → Providers.' }
        }
        return { error: msg }
      }
      return { error: null }
    }
  }

  const deleteAccount = async () => {
    if (!session?.user) return { error: 'Not signed in' }
    try {
      // Refresh to ensure a valid JWT
      await supabase.auth.refreshSession()

      const { data, error: fnError } = await supabase.functions.invoke('delete-account')
      if (fnError) {
        // supabase.functions.invoke wraps non-2xx as FunctionsHttpError
        // Try to extract the real error from the response context
        const ctx = (fnError as any).context
        let detail = fnError.message
        if (ctx instanceof Response) {
          try { const b = await ctx.json(); detail = b.error || detail } catch {}
        }
        return { error: detail || 'Failed to delete account' }
      }

      await supabase.auth.signOut()
      return { error: null }
    } catch {
      return { error: 'Something went wrong. Please try again.' }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signUp, signIn, signInWithGoogle, signInWithApple, deleteAccount, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
