import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import OnboardingLayout from '../../components/layout/OnboardingLayout'
import RadioOption from '../../components/ui/RadioOption'
import Toggle from '../../components/ui/Toggle'
import Button from '../../components/ui/Button'
import { useOnboarding } from '../../context/OnboardingContext'
import { track } from '../../lib/analytics'

const housingTypes = [
  { id: 'private_room', label: 'Private bedroom' },
  { id: 'shared_room', label: 'Shared bedroom' },
  { id: 'studio', label: 'Studio' },
  { id: 'apartment', label: 'Apartment' },
  { id: 'student_residence', label: 'Student residence' },
]

export default function HousingTypePage() {
  const navigate = useNavigate()
  const { data, setData } = useOnboarding()
  const [selected, setSelected] = useState(data.housingType || '')
  const [openToAnything, setOpenToAnything] = useState(false)

  const handleNext = () => {
    if (!selected && !openToAnything) return
    track('onboarding_step_completed', { step_name: 'housing-type' })
    setData({ housingType: openToAnything ? 'any' : selected })
    navigate('/onboarding/location')
  }

  return (
    <OnboardingLayout currentStep={3} totalSteps={7}>
      <div className="flex flex-col flex-1 px-5">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground leading-tight mb-2">
            What kind of place are you looking for?
          </h1>
          <p className="text-[15px] text-muted leading-relaxed">
            We'll filter listings across all platforms to only show you what matches.
          </p>
        </div>

        <div className="mb-5">
          <Toggle
            label="Show me everything"
            checked={openToAnything}
            onChange={setOpenToAnything}
          />
        </div>

        {!openToAnything && (
          <div className="divide-y divide-neutral-100">
            {housingTypes.map((t) => (
              <RadioOption
                key={t.id}
                label={t.label}
                selected={selected === t.id}
                onSelect={() => setSelected(t.id)}
              />
            ))}
          </div>
        )}

        <div className="mt-auto pb-8 pt-6">
          <Button onClick={handleNext} disabled={!openToAnything && !selected}>
            Next
          </Button>
        </div>
      </div>
    </OnboardingLayout>
  )
}
