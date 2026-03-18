import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bell, Zap, Clock } from 'lucide-react'
import OnboardingLayout from '../../components/layout/OnboardingLayout'
import Button from '../../components/ui/Button'
import { track } from '../../lib/analytics'

const features = [
  {
    icon: Zap,
    title: 'Instant alerts',
    desc: 'Get notified the second a room matching your criteria appears — before anyone else.',
  },
  {
    icon: Bell,
    title: 'Email notifications',
    desc: 'We\'ll send matching listings directly to your inbox with one-click apply.',
  },
  {
    icon: Clock,
    title: 'Be first every time',
    desc: 'In Amsterdam, listings disappear in minutes. Speed is everything.',
  },
]

export default function NotificationsPage() {
  const navigate = useNavigate()

  const handleEnable = () => {
    track('onboarding_step_completed', { step_name: 'notifications', action: 'enable' })
    navigate('/onboarding/community')
  }

  return (
    <OnboardingLayout currentStep={7} totalSteps={7}>
      <div className="flex flex-col flex-1 px-5">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground leading-tight mb-2">
            Never miss a listing again.
          </h1>
          <p className="text-[15px] text-muted leading-relaxed">
            Enable notifications and Roof will alert you the moment a matching room appears.
          </p>
        </div>

        <div className="space-y-5 mb-8">
          {features.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              className="flex gap-4"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 + 0.1 }}
            >
              <div className="w-10 h-10 bg-secondary rounded-2xl flex-shrink-0 flex items-center justify-center">
                <Icon size={18} strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-foreground">{title}</p>
                <p className="text-sm text-muted leading-relaxed mt-0.5">{desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-auto pb-8 pt-2 space-y-3">
          <Button onClick={handleEnable}>
            Enable notifications
          </Button>
          <Button variant="ghost" onClick={() => {
            track('onboarding_step_completed', { step_name: 'notifications', action: 'skip' })
            navigate('/onboarding/community')
          }}>
            Not now
          </Button>
        </div>
      </div>
    </OnboardingLayout>
  )
}
