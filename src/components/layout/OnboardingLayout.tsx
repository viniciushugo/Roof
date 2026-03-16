import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

interface OnboardingLayoutProps {
  children: ReactNode
  currentStep: number
  totalSteps: number
  onBack?: () => void
  showBack?: boolean
}

export default function OnboardingLayout({
  children,
  currentStep,
  totalSteps,
  onBack,
  showBack = true,
}: OnboardingLayoutProps) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      navigate(-1)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Progress bar + back */}
      <div className="px-5 pt-header pb-4 flex-shrink-0">
        <div className="flex items-center gap-3 mb-5">
          {showBack && (
            <button
              onClick={handleBack}
              className="w-8 h-8 flex items-center justify-center -ml-1 active:opacity-60"
            >
              <ChevronLeft size={22} strokeWidth={2} className="text-foreground" />
            </button>
          )}
          <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-foreground rounded-full"
              initial={{ width: `${((currentStep - 1) / totalSteps) * 100}%` }}
              animate={{ width: `${(currentStep / totalSteps) * 100}%` }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <motion.div
        className="flex-1 flex flex-col overflow-y-auto scrollbar-hide"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </div>
  )
}
