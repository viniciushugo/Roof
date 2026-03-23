import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import OnboardingLayout from '../../components/layout/OnboardingLayout'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import { useOnboarding } from '../../context/OnboardingContext'
import { track } from '../../lib/analytics'

export default function NamePage() {
  const navigate = useNavigate()
  const { data, setData } = useOnboarding()
  const [name, setName] = useState(data.name || '')

  const handleNext = () => {
    if (!name.trim()) return
    track('onboarding_step_completed', { step_name: 'name' })
    setData({ name: name.trim() })
    navigate('/onboarding/account')
  }

  return (
    <OnboardingLayout currentStep={1} totalSteps={7} showBack={false}>
      <div className="flex flex-col flex-1 px-5">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground leading-tight mb-2">
            Let's set up<br />your search alert.
          </h1>
          <p className="text-[15px] text-muted leading-relaxed">
            Takes 2 minutes. We'll scan Pararius, Kamernet, Funda and more — every day, for you.
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-[17px] font-bold text-foreground mb-3">
              What's your name?
            </h2>
            <Input
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleNext()}
            />
          </div>
        </div>

        <div className="mt-auto pb-8 pt-6">
          <Button onClick={handleNext} disabled={!name.trim()}>
            Next
          </Button>
        </div>
      </div>
    </OnboardingLayout>
  )
}
