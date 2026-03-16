import { memo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Heart, Bell, Layers } from 'lucide-react'

const SLIDES = [
  {
    icon: Search,
    color: 'bg-blue-500',
    title: 'Search & Filter',
    description: 'Find your perfect place by searching neighbourhoods or filtering by price, size, furnished status and more.',
  },
  {
    icon: Heart,
    color: 'bg-rose-500',
    title: 'Like Listings',
    description: 'Tap the heart to like listings. Access them anytime from the Liked tab so you never lose track.',
  },
  {
    icon: Bell,
    color: 'bg-amber-500',
    title: 'Set Alerts',
    description: 'Create alerts and get a push notification the moment a new listing matches your criteria.',
  },
  {
    icon: Layers,
    color: 'bg-violet-500',
    title: 'Catch Up',
    description: 'Swipe through new listings to quickly review what\'s fresh today — like or skip in one gesture.',
  },
]

interface Props {
  onComplete: () => void
  onSkip: () => void
}

const OnboardingTour = memo(function OnboardingTour({ onComplete, onSkip }: Props) {
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const isLast = index === SLIDES.length - 1
  const slide = SLIDES[index]

  const go = (next: number) => {
    setDirection(next > index ? 1 : -1)
    setIndex(next)
  }

  const handleNext = () => {
    if (isLast) { onComplete(); return }
    go(index + 1)
  }

  const variants = {
    enter: (d: number) => ({ x: d * 60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d * -60, opacity: 0 }),
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-[9998]" onClick={onSkip} />

      {/* Bottom sheet */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 bg-background rounded-t-[32px] z-[9999] pb-safe-bottom"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Slide content */}
        <div className="relative overflow-hidden" style={{ height: 260 }}>
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={index}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.85 }}
              className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center"
            >
              {/* Icon bubble */}
              <div className={`w-20 h-20 ${slide.color} rounded-3xl flex items-center justify-center mb-6 shadow-lg`}>
                <slide.icon size={36} strokeWidth={1.5} className="text-white" />
              </div>

              <h2 className="text-xl font-bold text-foreground mb-3 leading-tight">
                {slide.title}
              </h2>
              <p className="text-[15px] text-muted leading-relaxed">
                {slide.description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              className={`rounded-full transition-all duration-300 ${i === index ? 'w-6 h-2 bg-foreground' : 'w-2 h-2 bg-border'}`}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="px-5 pb-8 flex gap-3">
          <button
            onClick={onSkip}
            className="flex-1 h-13 px-4 py-3.5 rounded-2xl bg-secondary text-foreground text-[15px] font-medium active:opacity-70 transition-opacity"
          >
            Skip
          </button>
          <button
            onClick={handleNext}
            className="flex-1 h-13 px-4 py-3.5 rounded-2xl bg-foreground text-background text-[15px] font-semibold active:opacity-80 transition-opacity"
          >
            {isLast ? 'Get started' : 'Next'}
          </button>
        </div>
      </motion.div>
    </>
  )
})

OnboardingTour.displayName = 'OnboardingTour'
export default OnboardingTour
