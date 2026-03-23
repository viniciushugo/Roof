import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { User, CreditCard, LogOut, ChevronRight, X, Heart, Bell, Mail, Zap, Clock, Lightbulb, Send, Trash2 } from 'lucide-react'
import BottomNav from '../../components/layout/BottomNav'
import RoofLogo from '../../assets/RoofLogo'
import Toggle from '../../components/ui/Toggle'
import { useOnboarding } from '../../context/OnboardingContext'
import { useNotifications } from '../../context/NotificationsContext'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

const ABOUT_ITEMS = [
  { label: 'Privacy Policy', path: '/app/privacy' },
  { label: 'Terms of Service', path: '/app/terms' },
]

export default function AccountPage() {
  const navigate = useNavigate()
  const { data } = useOnboarding()
  const { prefs, setPref } = useNotifications()
  const { signOut, deleteAccount, user } = useAuth()
  const name = data.name || 'You'
  const [showPremiumModal, setShowPremiumModal] = useState(false)
  const [showFeatureModal, setShowFeatureModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [featureMessage, setFeatureMessage] = useState('')
  const [featureSending, setFeatureSending] = useState(false)
  const [featureSent, setFeatureSent] = useState(false)

  const handleSendFeature = async () => {
    if (!featureMessage.trim()) return
    setFeatureSending(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await supabase.functions.invoke('send-feature-request', {
        body: {
          message: featureMessage.trim(),
          userEmail: user?.email ?? 'anonymous',
        },
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      })
      setFeatureSent(true)
      setTimeout(() => {
        setShowFeatureModal(false)
        setTimeout(() => { setFeatureSent(false); setFeatureMessage('') }, 300)
      }, 1800)
    } catch {
      setFeatureSending(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/welcome')
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    setDeleteError(null)
    const { error } = await deleteAccount()
    if (error) {
      setDeleteError(error)
      setDeleting(false)
    } else {
      navigate('/welcome', { replace: true })
    }
  }

  return (
    <>
      <div className="flex flex-col h-full bg-background">
        <div className="flex-shrink-0 px-5 pt-header pb-4 border-b border-border">
          <h1 className="text-2xl font-bold text-foreground">Account</h1>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {/* Avatar + name */}
          <div className="flex items-center gap-4 px-5 py-6 border-b border-border">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center flex-shrink-0">
              <User size={28} strokeWidth={1.5} className="text-muted" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">{name}</h2>
              <p className="text-sm text-muted">
                {data.cities?.join(', ') || 'Amsterdam'} · {data.housingType?.replace('_', ' ') || 'Room hunter'}
              </p>
            </div>
          </div>

          {/* Upgrade + Request a feature */}
          <div className="px-5 py-2 border-b border-border space-y-0">
            <button
              onClick={() => setShowPremiumModal(true)}
              className="flex items-center gap-3 w-full py-4 active:opacity-60 transition-opacity"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-foreground">
                <CreditCard size={16} strokeWidth={1.8} className="text-background" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[15px] font-semibold text-foreground">Upgrade to Premium</p>
              </div>
              <ChevronRight size={16} className="text-muted flex-shrink-0" />
            </button>
            <button
              onClick={() => setShowFeatureModal(true)}
              className="flex items-center gap-3 w-full py-4 active:opacity-60 transition-opacity"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-foreground">
                <Lightbulb size={16} strokeWidth={1.8} className="text-background" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[15px] font-semibold text-foreground">Request a feature</p>
              </div>
              <ChevronRight size={16} className="text-muted flex-shrink-0" />
            </button>
          </div>

          {/* Notifications */}
          <div className="px-5 pt-5 pb-3 border-b border-border">
            <div className="flex items-center gap-2 mb-4">
              <Bell size={15} strokeWidth={1.8} className="text-foreground" />
              <h2 className="text-[13px] font-semibold text-muted uppercase tracking-wide">Notifications</h2>
            </div>
            <div className="space-y-4">
              {[
                { icon: Zap, key: 'instantAlerts' as const, label: 'Instant alerts', desc: 'Get notified the moment a listing appears' },
                { icon: Mail, key: 'emailAlerts' as const, label: 'Email alerts', desc: 'Matching listings sent to your inbox' },
                { icon: Clock, key: 'dailyDigest' as const, label: 'Daily digest', desc: 'Daily email at 6 PM with all new matches' },
              ].map(({ icon: Icon, key, label, desc }) => (
                <div key={key} className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-secondary rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon size={16} strokeWidth={1.8} className="text-foreground" />
                  </div>
                  <div className="flex-1">
                    <Toggle label={label} checked={prefs[key]} onChange={(v) => setPref(key, v)} />
                    <p className="text-xs text-muted mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* About */}
          <div className="px-5 pt-5 pb-3 border-b border-border">
            <h2 className="text-[13px] font-semibold text-muted uppercase tracking-wide mb-4">About</h2>
            {ABOUT_ITEMS.map(item => (
              <button key={item.path} onClick={() => navigate(item.path)}
                className="flex justify-between items-center w-full text-[15px] text-foreground py-3 active:opacity-60">
                {item.label}
                <ChevronRight size={16} className="text-muted" />
              </button>
            ))}
          </div>

          {/* Sign out */}
          <div className="px-5 py-4 space-y-1">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full py-3 text-left active:opacity-60"
            >
              <div className="w-9 h-9 bg-red-50 dark:bg-red-950 rounded-xl flex items-center justify-center">
                <LogOut size={16} strokeWidth={1.8} className="text-red-500" />
              </div>
              <span className="text-[15px] text-red-500">Sign out</span>
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-3 w-full py-3 text-left active:opacity-60"
            >
              <div className="w-9 h-9 bg-red-50 dark:bg-red-950 rounded-xl flex items-center justify-center">
                <Trash2 size={16} strokeWidth={1.8} className="text-red-500" />
              </div>
              <span className="text-[15px] text-red-500">Delete account</span>
            </button>
          </div>

          <p className="text-center text-xs text-muted pb-8">Roof v0.1.0 · Made by expats</p>
        </div>

        <BottomNav />
      </div>

      {/* Premium modal */}
      <AnimatePresence>
        {showPremiumModal && (
          <>
            <motion.div className="absolute inset-0 bg-black/40 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPremiumModal(false)} />
            <motion.div className="absolute bottom-0 left-0 right-0 bg-background rounded-t-[32px] z-50 pb-safe-bottom"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}>
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>
              <div className="px-6 pt-4 pb-8">
                <div className="flex justify-end mb-4">
                  <button onClick={() => setShowPremiumModal(false)} className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center active:opacity-60 text-foreground">
                    <X size={15} strokeWidth={2} className="text-muted" />
                  </button>
                </div>
                <div className="flex justify-center mb-5">
                  <RoofLogo className="text-foreground" size={80} />
                </div>
                <h2 className="text-2xl font-bold text-foreground text-center mb-3">Roof is free.</h2>
                <p className="text-[15px] text-muted leading-relaxed text-center mb-3">
                  We believe everyone deserves equal access to the housing market — not just those who can afford to pay for it.
                </p>
                <p className="text-[15px] text-muted leading-relaxed text-center mb-6">
                  All listings, all alerts, no paywall. That's a promise.
                </p>
                <div className="h-px bg-border mb-5" />
                <div className="flex items-start gap-3 mb-6">
                  <div className="w-8 h-8 bg-secondary rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Heart size={14} strokeWidth={1.8} className="text-muted" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-0.5">What about the future?</p>
                    <p className="text-sm text-muted leading-relaxed">
                      If we ever introduce paid features, they'll be things like landlord tools, lease assistance, or relocation services — never basic access to listings or alerts.
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowPremiumModal(false)} className="w-full h-14 bg-foreground text-background rounded-2xl text-[15px] font-semibold active:opacity-80">
                  Got it 🙌
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Feature request modal */}
      <AnimatePresence>
        {showFeatureModal && (
          <>
            <motion.div className="absolute inset-0 bg-black/40 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowFeatureModal(false)} />
            <motion.div className="absolute bottom-0 left-0 right-0 bg-background rounded-t-[32px] z-50 pb-safe-bottom"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}>
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>
              <div className="px-6 pt-4 pb-8">
                <div className="flex justify-end mb-4">
                  <button onClick={() => setShowFeatureModal(false)} className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center active:opacity-60 text-foreground">
                    <X size={15} strokeWidth={2} className="text-muted" />
                  </button>
                </div>

                {featureSent ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center py-8"
                  >
                    <RoofLogo className="text-foreground mb-5" size={64} />
                    <h2 className="text-2xl font-bold text-foreground text-center mb-2">Message received.</h2>
                    <p className="text-[15px] text-muted text-center">We'll read it. We promise.</p>
                  </motion.div>
                ) : (
                  <>
                    <div className="flex justify-center mb-5">
                      <RoofLogo className="text-foreground" size={64} />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground text-center mb-3">
                      We build Roof for you.
                    </h2>
                    <p className="text-[15px] text-muted leading-relaxed text-center mb-6">
                      Got an idea? A complaint? A love letter? We read every single message. Tell us what you want — we'll build it.
                    </p>

                    <textarea
                      value={featureMessage}
                      onChange={(e) => setFeatureMessage(e.target.value)}
                      placeholder="I wish Roof could..."
                      rows={4}
                      className="w-full px-4 py-3 rounded-2xl border border-border bg-secondary text-[15px] text-foreground placeholder:text-muted resize-none focus:outline-none focus:ring-2 focus:ring-foreground/20 mb-4"
                    />

                    <button
                      onClick={handleSendFeature}
                      disabled={featureSending || !featureMessage.trim()}
                      className="w-full h-14 bg-foreground text-background rounded-2xl text-[15px] font-semibold active:opacity-80 disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      <Send size={16} strokeWidth={2} />
                      {featureSending ? 'Sending...' : 'Send it'}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete account confirmation modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <>
            <motion.div className="absolute inset-0 bg-black/40 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !deleting && setShowDeleteModal(false)} />
            <motion.div className="absolute bottom-0 left-0 right-0 bg-background rounded-t-[32px] z-50 pb-safe-bottom"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}>
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>
              <div className="px-6 pt-4 pb-8">
                <div className="flex justify-end mb-4">
                  <button onClick={() => !deleting && setShowDeleteModal(false)} className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center active:opacity-60 text-foreground">
                    <X size={15} strokeWidth={2} className="text-muted" />
                  </button>
                </div>

                <div className="flex justify-center mb-5">
                  <div className="w-16 h-16 bg-red-50 dark:bg-red-950 rounded-3xl flex items-center justify-center">
                    <Trash2 size={28} strokeWidth={1.5} className="text-red-500" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-foreground text-center mb-3">Delete your account?</h2>
                <p className="text-[15px] text-muted leading-relaxed text-center mb-6">
                  This will permanently delete your account, saved listings, search alerts, and all associated data. This action cannot be undone.
                </p>

                {deleteError && (
                  <p className="text-sm text-red-500 font-medium text-center mb-4">{deleteError}</p>
                )}

                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="w-full h-14 bg-red-500 text-white rounded-2xl text-[15px] font-semibold active:opacity-80 disabled:opacity-40 mb-3"
                >
                  {deleting ? 'Deleting…' : 'Delete my account'}
                </button>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className="w-full h-14 bg-secondary text-foreground rounded-2xl text-[15px] font-semibold active:opacity-80"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
