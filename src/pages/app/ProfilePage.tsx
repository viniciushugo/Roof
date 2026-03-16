import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { User, CreditCard, LogOut, ChevronRight, X, Heart } from 'lucide-react'
import BottomNav from '../../components/layout/BottomNav'
import RoofLogo from '../../assets/RoofLogo'
import { useOnboarding } from '../../context/OnboardingContext'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { data } = useOnboarding()
  const name = data.name || 'You'
  const [showPremiumModal, setShowPremiumModal] = useState(false)

  const menuItems = [
    {
      icon: CreditCard,
      label: 'Upgrade to Premium',
      desc: null,
      action: () => setShowPremiumModal(true),
      highlight: true,
    },
  ]

  return (
    <>
      <div className="flex flex-col h-full bg-background">
        <div className="flex-shrink-0 px-5 pt-header pb-4 border-b border-border">
          <h1 className="text-2xl font-bold text-foreground">Profile</h1>
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

          {/* Menu */}
          <div className="px-5 pb-4">
            {menuItems.map(({ icon: Icon, label, desc, action, highlight }) => (
              <button
                key={label}
                onClick={action}
                className="flex items-center gap-3 w-full py-4 border-b border-border last:border-0 active:opacity-60 transition-opacity"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${highlight ? 'bg-foreground' : 'bg-secondary'}`}>
                  <Icon size={16} strokeWidth={1.8} className={highlight ? 'text-background' : 'text-foreground'} />
                </div>
                <div className="flex-1 text-left">
                  <p className={`text-[15px] ${highlight ? 'font-semibold' : ''} text-foreground`}>{label}</p>
                  {desc && <p className="text-xs text-muted mt-0.5">{desc}</p>}
                </div>
                <ChevronRight size={16} className="text-muted flex-shrink-0" />
              </button>
            ))}
          </div>

          {/* Sign out */}
          <div className="px-5 pb-8">
            <button
              onClick={() => navigate('/welcome')}
              className="flex items-center gap-3 w-full py-4 text-left active:opacity-60"
            >
              <div className="w-9 h-9 bg-red-50 dark:bg-red-950 rounded-xl flex items-center justify-center">
                <LogOut size={16} strokeWidth={1.8} className="text-red-500" />
              </div>
              <span className="text-[15px] text-red-500">Sign out</span>
            </button>
          </div>
        </div>

        <BottomNav />
      </div>

      {/* Premium modal */}
      <AnimatePresence>
        {showPremiumModal && (
          <>
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/40 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPremiumModal(false)}
            />

            {/* Sheet */}
            <motion.div
              className="absolute bottom-0 left-0 right-0 bg-background rounded-t-[32px] z-50 pb-safe-bottom"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>

              <div className="px-6 pt-4 pb-8">
                {/* Close */}
                <div className="flex justify-end mb-4">
                  <button
                    onClick={() => setShowPremiumModal(false)}
                    className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center active:opacity-60 text-foreground"
                  >
                    <X size={15} strokeWidth={2} className="text-muted" />
                  </button>
                </div>

                {/* Logo */}
                <div className="flex justify-center mb-5">
                  <RoofLogo className="text-foreground" size={80} />
                </div>

                {/* Message */}
                <h2 className="text-2xl font-bold text-foreground text-center mb-3">
                  Roof is free.
                </h2>
                <p className="text-[15px] text-muted leading-relaxed text-center mb-3">
                  We believe everyone deserves equal access to the housing market — not just those who can afford to pay for it.
                </p>
                <p className="text-[15px] text-muted leading-relaxed text-center mb-6">
                  All listings, all alerts, no paywall. That's a promise.
                </p>

                {/* Divider */}
                <div className="h-px bg-border mb-5" />

                {/* Future note */}
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

                <button
                  onClick={() => setShowPremiumModal(false)}
                  className="w-full h-14 bg-foreground text-background rounded-2xl text-[15px] font-semibold active:opacity-80 transition-colors"
                >
                  Got it 🙌
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
