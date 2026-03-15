import { memo, useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface TourStep {
  title: string
  description: string
  selector: string
  position: 'top' | 'bottom'
}

const STEPS: TourStep[] = [
  {
    title: 'Search & Filter',
    description:
      'Find your perfect place by searching neighborhoods or filtering by price, size, and more.',
    selector: '[data-tour="search"]',
    position: 'bottom',
  },
  {
    title: 'Save Listings',
    description:
      'Tap the heart to save listings you like. Access them anytime from the Saved tab.',
    selector: '[data-tour="save"]',
    position: 'bottom',
  },
  {
    title: 'Set Alerts',
    description:
      'Create alerts to get notified when new listings match your criteria.',
    selector: '[data-tour="alerts"]',
    position: 'top',
  },
  {
    title: 'Catch Up',
    description:
      'Swipe through new listings Tinder-style to quickly review what\'s new.',
    selector: '[data-tour="catchup"]',
    position: 'bottom',
  },
]

interface Props {
  onComplete: () => void
  onSkip: () => void
}

const PADDING = 8

function getRect(selector: string): DOMRect | null {
  const el = document.querySelector(selector)
  return el ? el.getBoundingClientRect() : null
}

const OnboardingTour = memo(function OnboardingTour({ onComplete, onSkip }: Props) {
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const rafRef = useRef(0)

  const current = STEPS[step]

  const measureRect = useCallback(() => {
    setRect(getRect(STEPS[step].selector))
  }, [step])

  useEffect(() => {
    // Small delay so DOM has time to paint
    const id = requestAnimationFrame(() => {
      measureRect()
    })
    rafRef.current = id
    window.addEventListener('resize', measureRect)
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', measureRect)
    }
  }, [measureRect])

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1)
    else onComplete()
  }

  // Spotlight cutout dimensions
  const sx = rect ? rect.x - PADDING : 0
  const sy = rect ? rect.y - PADDING : 0
  const sw = rect ? rect.width + PADDING * 2 : 0
  const sh = rect ? rect.height + PADDING * 2 : 0

  // Tooltip placement
  const tooltipStyle: React.CSSProperties = {}
  if (rect) {
    tooltipStyle.left = Math.max(16, Math.min(rect.x, window.innerWidth - 310))
    if (current.position === 'bottom') {
      tooltipStyle.top = rect.bottom + PADDING + 12
    } else {
      tooltipStyle.bottom = window.innerHeight - rect.top + PADDING + 12
    }
  }

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Backdrop with spotlight cutout */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={sx}
                y={sy}
                width={sw}
                height={sh}
                rx={14}
                ry={14}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#spotlight-mask)"
          style={{ pointerEvents: 'auto' }}
          onClick={next}
        />
      </svg>

      {/* Tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: current.position === 'bottom' ? -6 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: current.position === 'bottom' ? -6 : 6 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="absolute w-[290px] bg-white rounded-2xl shadow-lg p-5 z-[10000]"
          style={tooltipStyle}
        >
          <p className="text-[15px] font-semibold text-foreground mb-1">{current.title}</p>
          <p className="text-sm text-muted leading-relaxed mb-4">{current.description}</p>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted font-medium">
              {step + 1}/{STEPS.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onSkip}
                className="px-4 h-8 rounded-full text-sm font-medium text-muted active:opacity-60 transition-opacity"
              >
                Skip
              </button>
              <button
                onClick={next}
                className="px-4 h-8 bg-foreground text-white rounded-full text-sm font-medium active:opacity-80 transition-opacity"
              >
                {step < STEPS.length - 1 ? 'Next' : 'Done'}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
})

OnboardingTour.displayName = 'OnboardingTour'
export default OnboardingTour
