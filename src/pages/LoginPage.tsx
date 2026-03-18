import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, ChevronDown } from 'lucide-react'
import RoofLogo from '../assets/RoofLogo'
import Button from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'

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

export default function LoginPage() {
  const navigate = useNavigate()
  const { signIn, signInWithGoogle, session } = useAuth()

  // When session appears (e.g. after Google OAuth deep-link), navigate away
  useEffect(() => {
    if (session) {
      navigate('/app/rooms', { replace: true })
    }
  }, [session, navigate])

  const [showEmailForm, setShowEmailForm] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignIn = async () => {
    if (!email || !password) { setError('Please fill in all fields.'); return }
    setLoading(true)
    setError(null)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      setError('Invalid email or password.')
    } else {
      navigate('/app/rooms')
    }
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    setError(null)
    const { error } = await signInWithGoogle()
    setGoogleLoading(false)
    if (error) setError(error)
  }

  return (
    <motion.div
      className="flex flex-col min-h-full bg-background px-5 overflow-y-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <div className="flex-1 flex flex-col justify-center py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8"
        >
          <RoofLogo className="text-foreground" size={80} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.4 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-foreground leading-tight mb-1">
            Welcome back
          </h1>
          <p className="text-[15px] text-muted">Sign in to your Roof account.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.4 }}
          className="space-y-3"
        >
          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full h-14 rounded-2xl border border-border bg-background flex items-center justify-center gap-3 text-[15px] font-medium text-foreground active:bg-secondary transition-colors disabled:opacity-60"
          >
            <GoogleIcon />
            {googleLoading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          {/* Email toggle */}
          <button
            onClick={() => setShowEmailForm((v) => !v)}
            className="w-full h-14 rounded-2xl bg-secondary flex items-center justify-center gap-2 text-[15px] font-medium text-foreground active:opacity-75 transition-opacity"
          >
            Sign in with email
            <ChevronDown
              size={16}
              strokeWidth={2}
              className={`text-muted transition-transform duration-200 ${showEmailForm ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Email form (collapsible) */}
          <AnimatePresence>
            {showEmailForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="space-y-3 pt-1">
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
                  <Button onClick={handleSignIn} disabled={loading}>
                    {loading ? 'Signing in…' : 'Sign in'}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <p className="text-sm text-red-500 font-medium text-center">{error}</p>
          )}
        </motion.div>
      </div>

      {/* Create account — always visible and prominent */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28, duration: 0.4 }}
        className="pb-10 space-y-3"
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted font-medium">New to Roof?</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <Button variant="secondary" onClick={() => navigate('/onboarding/name')}>
          Create an account
        </Button>
      </motion.div>
    </motion.div>
  )
}
