import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import OnboardingLayout from '../../components/layout/OnboardingLayout'
import Button from '../../components/ui/Button'
import { useOnboarding } from '../../context/OnboardingContext'
import { track } from '../../lib/analytics'

const BEDROOM_OPTIONS = [
  { label: '1', value: 1 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: '4+', value: 4 },
]

const INTERIOR_OPTIONS = [
  { label: 'Any', value: 'any' },
  { label: 'Furnished', value: 'furnished' },
  { label: 'Upholstered', value: 'upholstered' },
  { label: 'Unfurnished', value: 'unfurnished' },
]

export default function FilterDetailsPage() {
  const navigate = useNavigate()
  const { setData } = useOnboarding()
  const [sizeMin, setSizeMin] = useState('')
  const [sizeMax, setSizeMax] = useState('')
  const [bedrooms, setBedrooms] = useState<number[]>([])
  const [interior, setInterior] = useState('any')

  const toggleBedroom = (v: number) => {
    setBedrooms((prev) =>
      prev.includes(v) ? prev.filter((b) => b !== v) : [...prev, v]
    )
  }

  const handleNext = () => {
    track('onboarding_step_completed', { step_name: 'filter-details' })
    setData({
      sizeMin: sizeMin ? parseInt(sizeMin) : undefined,
      sizeMax: sizeMax ? parseInt(sizeMax) : undefined,
      bedrooms: bedrooms.length > 0 ? bedrooms : undefined,
      interior: interior !== 'any' ? interior : undefined,
    } as Parameters<typeof setData>[0])
    navigate('/onboarding/notifications')
  }

  return (
    <OnboardingLayout currentStep={6} totalSteps={7}>
      <div className="flex flex-col flex-1 px-5">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground leading-tight mb-2">
            Any size or style preferences?
          </h1>
          <p className="text-[15px] text-muted leading-relaxed">
            Optional. Skip if you're open to anything — you can always refine in the app.
          </p>
        </div>

        <div className="space-y-7">
          {/* Size */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <p className="text-[15px] font-semibold text-foreground mb-3">Size (m²)</p>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="number"
                  value={sizeMin}
                  onChange={(e) => setSizeMin(e.target.value)}
                  placeholder="Min"
                  className="w-full h-12 px-4 rounded-xl border border-border text-[15px] text-foreground bg-background focus:border-foreground transition-colors"
                />
              </div>
              <div className="flex items-center text-muted text-sm">–</div>
              <div className="flex-1 relative">
                <input
                  type="number"
                  value={sizeMax}
                  onChange={(e) => setSizeMax(e.target.value)}
                  placeholder="Max"
                  className="w-full h-12 px-4 rounded-xl border border-border text-[15px] text-foreground bg-background focus:border-foreground transition-colors"
                />
              </div>
            </div>
          </motion.div>

          {/* Bedrooms */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <p className="text-[15px] font-semibold text-foreground mb-3">Bedrooms</p>
            <div className="flex gap-2">
              {BEDROOM_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => toggleBedroom(o.value)}
                  className={`flex-1 h-12 rounded-xl text-sm font-medium border transition-all ${
                    bedrooms.includes(o.value)
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-background text-foreground border-border'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Interior */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <p className="text-[15px] font-semibold text-foreground mb-3">Interior</p>
            <div className="flex flex-wrap gap-2">
              {INTERIOR_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setInterior(o.value)}
                  className={`px-4 h-9 rounded-full text-sm font-medium border transition-all ${
                    interior === o.value
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-background text-foreground border-border'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="mt-auto pb-8 pt-6 space-y-3">
          <Button onClick={handleNext}>Next</Button>
          <Button variant="ghost" onClick={() => {
            track('onboarding_step_completed', { step_name: 'filter-details', action: 'skip' })
            navigate('/onboarding/notifications')
          }}>
            Skip for now
          </Button>
        </div>
      </div>
    </OnboardingLayout>
  )
}
