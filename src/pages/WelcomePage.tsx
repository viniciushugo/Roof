import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff } from 'lucide-react'
import RoofLogo from '../assets/RoofLogo'
import Button from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { trackEvent } from '../lib/amplitude'
import { useEffect } from 'react'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

export default function WelcomePage() {
  const navigate = useNavigate()
  const { signIn, signInWithGoogle, signInWithApple } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [appleLoading, setAppleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    trackEvent('welcome_screen_viewed')
  }, [])

  const handleSignIn = async () => {
    if (!email || !password) { setError('Please fill in all fields.'); return }
    trackEvent('login_started', { method: 'email' })
    setLoading(true); setError(null)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) setError('Invalid email or password.')
    else navigate('/app/rooms')
  }

  const handleGoogle = async () => {
    trackEvent('login_started', { method: 'google' })
    setGoogleLoading(true)
    setError(null)
    const { error } = await signInWithGoogle()
    setGoogleLoading(false)
    if (error) setError(error)
  }

  const handleApple = async () => {
    trackEvent('login_started', { method: 'apple' })
    setAppleLoading(true)
    setError(null)
    const { error } = await signInWithApple()
    setAppleLoading(false)
    if (error) setError(error)
  }

  return (
    <motion.div
      className="flex flex-col h-full bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      {/* Top: logo + tagline */}
      <div className="px-5 pt-header pb-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <RoofLogo className="text-foreground" size={72} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.4 }}
          className="mt-4"
        >
          <h1 className="text-2xl font-bold text-foreground leading-tight">Welcome back</h1>
          <p className="text-[15px] text-muted mt-1">Every listing in the Netherlands — one feed.</p>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="flex-1 px-5 flex flex-col"
      >
        {/* Apple button — required per App Store Guideline 4.8 */}
        <button
          onClick={handleApple}
          disabled={appleLoading}
          className="w-full h-12 rounded-2xl bg-foreground text-background flex items-center justify-center gap-3 text-[15px] font-semibold active:opacity-80 transition-opacity disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
            <path d="M14.94 13.38c-.35.81-.52 1.17-.97 1.89-.63.99-1.52 2.23-2.62 2.24-1.23.01-1.55-.8-3.22-.79-1.67.01-2.02.81-3.25.8-1.1-.01-1.94-1.12-2.57-2.12C.87 12.94.41 10.16 1.63 8.26c.87-1.35 2.24-2.14 3.5-2.14 1.3 0 2.12.81 3.2.81 1.04 0 1.68-.81 3.18-.81 1.12 0 2.33.61 3.19 1.66-2.8 1.54-2.35 5.54.24 6.6zM11.35 4.21c.5-.64.88-1.55.74-2.47-.82.06-1.78.58-2.33 1.25-.5.61-.92 1.53-.76 2.42.9.03 1.83-.5 2.35-1.2z"/>
          </svg>
          {appleLoading ? 'Redirecting…' : 'Sign in with Apple'}
        </button>

        {/* Google button */}
        <button
          onClick={handleGoogle}
          disabled={googleLoading}
          className="w-full h-12 rounded-2xl border border-border bg-background flex items-center justify-center gap-3 text-[15px] font-medium text-foreground active:bg-secondary transition-colors disabled:opacity-60 mt-3"
        >
          <GoogleIcon />
          {googleLoading ? 'Redirecting…' : 'Continue with Google'}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted font-medium">or sign in with email</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Email / password */}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full h-12 px-4 rounded-2xl border border-border bg-secondary text-[15px] text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                autoComplete="current-password"
                onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
                className="w-full h-12 px-4 pr-12 rounded-2xl border border-border bg-secondary text-[15px] text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
        </div>

        <div className="mt-5">
          <Button onClick={handleSignIn} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </div>
      </motion.div>

      {/* Bottom: create account */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.32, duration: 0.4 }}
        className="px-5 pb-10 pt-4 text-center"
      >
        <p className="text-sm text-muted">
          Don't have an account?{' '}
          <button
            onClick={() => navigate('/onboarding/name')}
            className="text-foreground font-semibold underline underline-offset-2"
          >
            Create one
          </button>
        </p>
      </motion.div>
    </motion.div>
  )
}
