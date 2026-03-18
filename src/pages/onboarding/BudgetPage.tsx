import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import OnboardingLayout from '../../components/layout/OnboardingLayout'
import Button from '../../components/ui/Button'
import { useOnboarding } from '../../context/OnboardingContext'
import { track } from '../../lib/analytics'

const PRESETS = [
  { label: '< €800',      min: 0,    max: 800  },
  { label: '€800–1,200',  min: 800,  max: 1200 },
  { label: '€1,200–1,800',min: 1200, max: 1800 },
  { label: '€1,800+',     min: 1800, max: 0    },
]

export default function BudgetPage() {
  const navigate = useNavigate()
  const { data, setData } = useOnboarding()
  const [min, setMin] = useState(data.budgetMin?.toString() || '')
  const [max, setMax] = useState(data.budgetMax?.toString() || '')

  const applyPreset = (p: typeof PRESETS[number]) => {
    setMin(p.min > 0 ? p.min.toString() : '')
    setMax(p.max > 0 ? p.max.toString() : '')
  }

  const activePreset = PRESETS.find(
    (p) => p.min === (parseInt(min) || 0) && p.max === (parseInt(max) || 0)
  )

  const handleNext = () => {
    track('onboarding_step_completed', { step_name: 'budget' })
    setData({ budgetMin: parseInt(min) || 0, budgetMax: parseInt(max) || 0 })
    navigate('/onboarding/filter-details')
  }

  return (
    <OnboardingLayout currentStep={5} totalSteps={7}>
      <div className="flex flex-col flex-1 px-5">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground leading-tight mb-2">
            What's your budget?
          </h1>
          <p className="text-[15px] text-muted leading-relaxed">
            We'll only surface listings within your range — no scrolling past places you can't afford.
          </p>
        </div>

        {/* Preset chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className={`px-4 h-9 rounded-full text-sm font-medium border transition-all ${
                activePreset === p
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-background text-foreground border-border'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Minimum (€/month)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-[15px]">€</span>
              <input
                type="number"
                className="w-full h-14 pl-8 pr-4 rounded-xl border border-border text-foreground text-[15px] bg-background focus:border-foreground transition-colors"
                placeholder="0"
                value={min}
                onChange={(e) => setMin(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Maximum (€/month)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-[15px]">€</span>
              <input
                type="number"
                className="w-full h-14 pl-8 pr-4 rounded-xl border border-border text-foreground text-[15px] bg-background focus:border-foreground transition-colors"
                placeholder="No limit"
                value={max}
                onChange={(e) => setMax(e.target.value)}
              />
            </div>
          </div>

          {(min || max) && (
            <div className="bg-secondary rounded-2xl p-4">
              <p className="text-sm text-muted mb-0.5">Your range</p>
              <p className="text-2xl font-bold text-foreground">
                {min ? `€${parseInt(min).toLocaleString()}` : '€0'}
                {' — '}
                {max ? `€${parseInt(max).toLocaleString()}` : 'No limit'}
                <span className="text-sm font-normal text-muted ml-1">/month</span>
              </p>
            </div>
          )}
        </div>

        <div className="mt-auto pb-8 pt-6">
          <Button onClick={handleNext}>
            Next
          </Button>
        </div>
      </div>
    </OnboardingLayout>
  )
}
