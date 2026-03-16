import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import OnboardingLayout from '../../components/layout/OnboardingLayout'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import { useOnboarding } from '../../context/OnboardingContext'

const CITIES = [
  'Amsterdam', 'Rotterdam', 'Utrecht', 'The Hague', 'Eindhoven',
  'Groningen', 'Tilburg', 'Almere', 'Breda', 'Nijmegen',
  'Enschede', 'Haarlem', 'Arnhem', 'Zaandam', 'Amersfoort',
  'Maastricht', 'Leiden', 'Dordrecht', 'Delft',
]

export default function LocationPage() {
  const navigate = useNavigate()
  const { data, setData } = useOnboarding()
  const [country, setCountry] = useState(data.country || 'Netherlands')
  const [cities, setCities] = useState<string[]>(data.cities || [])
  const [inputValue, setInputValue] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  const addCity = (city: string) => {
    if (!cities.includes(city)) setCities((prev) => [...prev, city])
    setInputValue('')
    setShowDropdown(false)
  }

  const removeCity = (city: string) => {
    setCities((prev) => prev.filter((c) => c !== city))
  }

  const suggestions = CITIES.filter(
    (c) => c.toLowerCase().includes(inputValue.toLowerCase()) && !cities.includes(c)
  )

  const handleNext = () => {
    if (cities.length === 0) return
    setData({ country, cities })
    navigate('/onboarding/budget')
  }

  return (
    <OnboardingLayout currentStep={4} totalSteps={7}>
      <div className="flex flex-col flex-1 px-5">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground leading-tight mb-2">
            Where do you want to live?
          </h1>
          <p className="text-[15px] text-muted leading-relaxed">
            We'll scan Pararius, Kamernet, Funda and more — only for listings available in your cities.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <select
              className="w-full h-14 px-4 rounded-xl border border-border text-foreground text-[15px] bg-secondary appearance-none focus:border-foreground transition-colors"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              <option value="Netherlands">🇳🇱 Netherlands</option>
              <option value="Belgium">🇧🇪 Belgium</option>
              <option value="Germany">🇩🇪 Germany</option>
            </select>
          </div>

          <div className="relative">
            <Input
              placeholder="Search or pick a city"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value)
                setShowDropdown(true)
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            />
            {showDropdown && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-xl shadow-xs z-10 overflow-hidden">
                {suggestions.map((c) => (
                  <button
                    key={c}
                    className="w-full text-left px-4 py-3 text-[15px] text-foreground hover:bg-secondary active:bg-secondary transition-colors"
                    onMouseDown={() => addCity(c)}
                  >
                    📍 {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {cities.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {cities.map((c) => (
                <div key={c} className="inline-flex items-center gap-2 bg-foreground text-background px-3 py-1.5 rounded-full text-sm font-medium">
                  📍 {c}
                  <button
                    onClick={() => removeCity(c)}
                    className="opacity-70 hover:opacity-100 leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-auto pb-8 pt-6">
          <Button onClick={handleNext} disabled={cities.length === 0}>
            Next
          </Button>
        </div>
      </div>
    </OnboardingLayout>
  )
}
