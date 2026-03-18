import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Mail, Zap, Clock, ChevronRight, Lightbulb, X, Send } from 'lucide-react'
import Toggle from '../../components/ui/Toggle'
import BottomNav from '../../components/layout/BottomNav'
import RoofLogo from '../../assets/RoofLogo'
import { useNotifications } from '../../context/NotificationsContext'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

const ABOUT_ITEMS = [
  { label: 'Privacy Policy', path: '/app/privacy' },
  { label: 'Terms of Service', path: '/app/terms' },
]

export default function SettingsPage() {
  const navigate = useNavigate()
  const { prefs, setPref } = useNotifications()
  const { user } = useAuth()

  const [showFeatureModal, setShowFeatureModal] = useState(false)
  const [featureMessage, setFeatureMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSendFeature = async () => {
    if (!featureMessage.trim()) return
    setSending(true)
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
      setSent(true)
      setTimeout(() => {
        setShowFeatureModal(false)
        // Reset after close animation
        setTimeout(() => { setSent(false); setFeatureMessage('') }, 300)
      }, 1800)
    } catch {
      // Silently fail — non-critical
      setSending(false)
    }
  }

  return (
    <div className="relative flex flex-col h-full bg-background">
      {/* Header — left-aligned, no back button (tab bar page) */}
      <div className="flex-shrink-0 px-5 pt-header pb-4 border-b border-border">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Notifications section */}
        <div className="px-5 py-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={16} strokeWidth={1.8} className="text-foreground" />
            <h2 className="text-[15px] font-semibold text-foreground">Notifications</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-secondary rounded-xl flex items-center justify-center flex-shrink-0">
                <Zap size={16} strokeWidth={1.8} className="text-foreground" />
              </div>
              <div className="flex-1">
                <Toggle label="Instant alerts" checked={prefs.instantAlerts} onChange={(v) => setPref('instantAlerts', v)} />
                <p className="text-xs text-muted mt-0.5">Get notified the moment a listing appears</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-secondary rounded-xl flex items-center justify-center flex-shrink-0">
                <Mail size={16} strokeWidth={1.8} className="text-foreground" />
              </div>
              <div className="flex-1">
                <Toggle label="Email alerts" checked={prefs.emailAlerts} onChange={(v) => setPref('emailAlerts', v)} />
                <p className="text-xs text-muted mt-0.5">Matching listings sent to your inbox</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-secondary rounded-xl flex items-center justify-center flex-shrink-0">
                <Clock size={16} strokeWidth={1.8} className="text-foreground" />
              </div>
              <div className="flex-1">
                <Toggle label="Daily digest" checked={prefs.dailyDigest} onChange={(v) => setPref('dailyDigest', v)} />
                <p className="text-xs text-muted mt-0.5">
                  Receive a daily email at 6 PM with all new listings that matched your search criteria throughout the day
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="h-px bg-border mx-5" />

        {/* About */}
        <div className="px-5 py-5 space-y-4">
          <h2 className="text-[15px] font-semibold text-foreground">About</h2>
          {ABOUT_ITEMS.map(item => (
            <button key={item.path} onClick={() => navigate(item.path)} className="flex justify-between items-center w-full text-[15px] text-foreground py-1 active:opacity-60">
              {item.label}
              <ChevronRight size={16} className="text-muted" />
            </button>
          ))}
        </div>

        <div className="h-px bg-border mx-5" />

        {/* Request a feature */}
        <div className="px-5 py-5">
          <button
            onClick={() => setShowFeatureModal(true)}
            className="flex items-center gap-3 w-full active:opacity-60"
          >
            <div className="w-9 h-9 bg-secondary rounded-xl flex items-center justify-center flex-shrink-0">
              <Lightbulb size={16} strokeWidth={1.8} className="text-foreground" />
            </div>
            <span className="flex-1 text-left text-[15px] font-medium text-foreground">Request a feature</span>
            <ChevronRight size={16} className="text-muted" />
          </button>
        </div>

        <p className="text-center text-xs text-muted pb-8">Roof v0.1.0 · Made by expats ❤️</p>
      </div>

      <BottomNav />

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

                {sent ? (
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
                      disabled={sending || !featureMessage.trim()}
                      className="w-full h-14 bg-foreground text-background rounded-2xl text-[15px] font-semibold active:opacity-80 disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      <Send size={16} strokeWidth={2} />
                      {sending ? 'Sending...' : 'Send it'}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
