import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Bell, Zap } from 'lucide-react'
import Button from '../../components/ui/Button'
import { useOnboarding } from '../../context/OnboardingContext'
import { useAlerts } from '../../context/AlertsContext'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { DEFAULT_FILTERS } from '../../components/ui/FiltersSheet'
import { track } from '../../lib/analytics'

const sources = ['Pararius', 'Kamernet', 'Funda', 'HousingAnywhere', 'Nestpick', 'Direct landlords']

function mapHousingType(raw: string | undefined): 'all' | 'room' | 'studio' | 'apartment' {
  if (!raw || raw === 'any') return 'all'
  if (raw === 'private_room' || raw === 'shared_room' || raw === 'student_residence') return 'room'
  if (raw === 'studio') return 'studio'
  if (raw === 'apartment') return 'apartment'
  return 'all'
}

function generateAlertName(cities: string[], type: 'all' | 'room' | 'studio' | 'apartment'): string {
  const cityPart = cities.length > 0 ? cities.slice(0, 2).join(', ') : 'Netherlands'
  const typePart = type === 'all' ? 'All types' : type.charAt(0).toUpperCase() + type.slice(1)
  return `${cityPart} – ${typePart}`
}

export default function CommunityPage() {
  const navigate = useNavigate()
  const { data } = useOnboarding()
  const { addAlert, alerts } = useAlerts()
  const { user } = useAuth()

  const summaryItems = [
    { label: data.cities && data.cities.length > 1 ? 'Cities' : 'City', value: data.cities?.join(', ') || 'Amsterdam' },
    {
      label: 'Type',
      value: data.housingType === 'any' ? 'Any' : (data.housingType?.replace('_', ' ') || 'Any'),
    },
    {
      label: 'Budget',
      value: `€${data.budgetMin || 600} – €${data.budgetMax || 1200}/mo`,
    },
  ]

  const handleStart = () => {
    track('onboarding_completed')

    // Create initial alert from onboarding preferences (only once)
    if (alerts.length === 0) {
      const cities = data.cities ?? []
      const housingType = mapHousingType(data.housingType)
      addAlert({
        name: generateAlertName(cities, housingType),
        cities,
        housingType,
        budgetMin: data.budgetMin ?? 0,
        budgetMax: data.budgetMax ?? 0,
        filters: DEFAULT_FILTERS,
      })
    }

    // Sync onboarding profile data to Supabase (non-blocking)
    if (user) {
      supabase.from('profiles').update({
        name: data.name ?? null,
        cities: data.cities ?? [],
        housing_type: data.housingType ?? 'any',
        budget_min: data.budgetMin ?? 0,
        budget_max: data.budgetMax ?? 0,
      }).eq('id', user.id)
    }

    navigate('/app/rooms')
  }

  return (
    <motion.div
      className="flex flex-col h-full bg-background px-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      {/* Top */}
      <div className="flex-1 flex flex-col justify-center">
        {/* Icon */}
        <motion.div
          className="w-16 h-16 bg-foreground rounded-3xl flex items-center justify-center mb-6"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <Search size={28} strokeWidth={1.8} className="text-background" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.4 }}
        >
          <h1 className="text-2xl font-bold text-foreground leading-tight mb-2">
            Your alert is live.
          </h1>
          <p className="text-[15px] text-muted leading-relaxed mb-6">
            We're now scanning listings across {sources.length} platforms, every day. You'll be the first to know.
          </p>
        </motion.div>

        {/* Search summary */}
        <motion.div
          className="bg-secondary rounded-2xl p-4 mb-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26, duration: 0.4 }}
        >
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Your search criteria</p>
          <div className="space-y-2">
            {summaryItems.map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-muted">{label}</span>
                <span className="font-medium text-foreground capitalize">{value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Platform list */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, duration: 0.4 }}
        >
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Scanning these platforms</p>
          <div className="flex flex-wrap gap-2">
            {sources.map((s, i) => (
              <motion.span
                key={s}
                className="px-3 py-1.5 bg-secondary rounded-full text-sm font-medium text-foreground"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.36 + i * 0.05 }}
              >
                {s}
              </motion.span>
            ))}
          </div>
        </motion.div>

        {/* Alert features */}
        <motion.div
          className="flex gap-5 mt-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
        >
          <div className="flex items-center gap-2 text-sm text-muted">
            <Bell size={14} strokeWidth={1.8} className="text-foreground" />
            Instant push alerts
          </div>
          <div className="flex items-center gap-2 text-sm text-muted">
            <Zap size={14} strokeWidth={1.8} className="text-foreground" />
            Updated daily
          </div>
        </motion.div>
      </div>

      {/* CTA */}
      <motion.div
        className="pb-10 pt-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
      >
        <Button onClick={handleStart}>
          See listings
        </Button>
      </motion.div>
    </motion.div>
  )
}
