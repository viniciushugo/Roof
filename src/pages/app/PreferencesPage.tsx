import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Check } from 'lucide-react'
import { useOnboarding } from '../../context/OnboardingContext'
import { useAlerts } from '../../context/AlertsContext'
import { DEFAULT_FILTERS } from '../../components/ui/FiltersSheet'
import Toggle from '../../components/ui/Toggle'
import { track } from '../../lib/analytics'

const CITIES = ['Amsterdam', 'Rotterdam', 'Utrecht', 'The Hague', 'Eindhoven', 'Groningen']

const housingTypes = [
  { id: 'apartment', label: 'Apartment' },
  { id: 'studio', label: 'Studio' },
  { id: 'private_room', label: 'Private bedroom' },
  { id: 'shared_room', label: 'Shared bedroom' },
  { id: 'student_residence', label: 'Student residence' },
]

function mapHousingTypeToAlert(raw: string): 'all' | 'room' | 'studio' | 'apartment' {
  if (raw === 'any' || !raw) return 'all'
  if (raw === 'private_room' || raw === 'shared_room' || raw === 'student_residence') return 'room'
  if (raw === 'studio') return 'studio'
  if (raw === 'apartment') return 'apartment'
  return 'all'
}

function mapAlertHousingTypeToOnboarding(type: 'all' | 'room' | 'studio' | 'apartment'): string {
  if (type === 'all') return 'any'
  if (type === 'room') return 'private_room'
  return type
}

export default function PreferencesPage() {
  const navigate = useNavigate()
  const { data, setData } = useOnboarding()
  const { alerts, updateAlert, addAlert } = useAlerts()

  // Use first alert as source of truth if one exists, fall back to onboarding data
  const primaryAlert = alerts[0] ?? null

  const [cities, setCities] = useState<string[]>(
    primaryAlert ? primaryAlert.cities : (data.cities || ['Amsterdam'])
  )
  const [inputValue, setInputValue] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [housingType, setHousingType] = useState<string>(
    primaryAlert
      ? mapAlertHousingTypeToOnboarding(primaryAlert.housingType)
      : (data.housingType || '')
  )
  const [openToAnything, setOpenToAnything] = useState(
    primaryAlert ? primaryAlert.housingType === 'all' : data.housingType === 'any'
  )
  const [min, setMin] = useState(
    primaryAlert
      ? (primaryAlert.budgetMin > 0 ? primaryAlert.budgetMin.toString() : '600')
      : (data.budgetMin?.toString() || '600')
  )
  const [max, setMax] = useState(
    primaryAlert
      ? (primaryAlert.budgetMax > 0 ? primaryAlert.budgetMax.toString() : '1200')
      : (data.budgetMax?.toString() || '1200')
  )

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

  const resolvedHousingType = mapHousingTypeToAlert(openToAnything ? 'any' : housingType)
  const alertName = cities.length > 0
    ? `${cities.slice(0, 2).join(', ')} – ${resolvedHousingType === 'all' ? 'All types' : resolvedHousingType.charAt(0).toUpperCase() + resolvedHousingType.slice(1)}`
    : 'Netherlands – All types'

  const handleSave = () => {
    const budgetMin = parseInt(min) || 0
    const budgetMax = parseInt(max) || 0

    track('preferences_updated', {
      cities,
      housingType: openToAnything ? 'any' : housingType,
      budgetMin,
      budgetMax,
    })

    // Update onboarding context
    setData({
      cities,
      housingType: openToAnything ? 'any' : housingType,
      budgetMin,
      budgetMax,
    })

    // Sync with primary alert
    if (primaryAlert) {
      updateAlert(primaryAlert.id, {
        name: alertName,
        cities,
        housingType: resolvedHousingType,
        budgetMin,
        budgetMax,
      })
    } else {
      // No alert yet — create one
      addAlert({
        name: alertName,
        cities,
        housingType: resolvedHousingType,
        budgetMin,
        budgetMax,
        filters: DEFAULT_FILTERS,
      })
    }

    navigate(-1)
  }

  const canSave = cities.length > 0 && (openToAnything || housingType)

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-header pb-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="active:opacity-60">
            <ChevronLeft size={22} strokeWidth={2} className="text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">Search preferences</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="flex items-center gap-1.5 text-sm font-semibold text-foreground disabled:text-muted transition-colors active:opacity-60"
        >
          <Check size={16} strokeWidth={2.5} />
          Save
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Cities */}
        <div className="px-5 pt-6 pb-5 border-b border-border">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Cities</p>
          <div className="relative mb-3">
            <input
              className="w-full h-14 px-4 rounded-xl border border-border text-foreground text-[15px] bg-background focus:border-foreground transition-colors"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value)
                setShowDropdown(e.target.value.length > 0)
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              placeholder="Search and add a city"
            />
            {showDropdown && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-xl shadow-xs z-10 overflow-hidden">
                {suggestions.map((c) => (
                  <button
                    key={c}
                    className="w-full text-left px-4 py-3 text-[15px] hover:bg-secondary active:bg-secondary transition-colors"
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

        {/* Housing type */}
        <div className="px-5 pt-5 pb-5 border-b border-border">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-4">Housing type</p>
          <div className="mb-4">
            <Toggle
              label="Show me everything"
              checked={openToAnything}
              onChange={(v) => {
                setOpenToAnything(v)
                if (v) setHousingType('')
              }}
            />
          </div>
          {!openToAnything && (
            <div className="divide-y divide-neutral-100">
              {housingTypes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setHousingType(t.id)}
                  className="flex items-center justify-between w-full py-3.5 active:opacity-60 transition-opacity"
                >
                  <span className="text-[15px] text-foreground">{t.label}</span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    housingType === t.id ? 'border-foreground bg-foreground' : 'border-border'
                  }`}>
                    {housingType === t.id && <div className="w-2 h-2 rounded-full bg-background" />}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Budget */}
        <div className="px-5 pt-5 pb-8">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-4">Budget</p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Minimum (€/month)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-[15px]">€</span>
                <input
                  type="number"
                  className="w-full h-14 pl-8 pr-4 rounded-xl border border-border text-foreground text-[15px] bg-background focus:border-foreground transition-colors"
                  placeholder="600"
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
                  placeholder="1200"
                  value={max}
                  onChange={(e) => setMax(e.target.value)}
                />
              </div>
            </div>
            <div className="bg-secondary rounded-2xl p-4 mt-1">
              <p className="text-sm text-muted mb-1">Your budget range</p>
              <p className="text-2xl font-bold text-foreground">
                €{min || '–'} — €{max || '–'}
                <span className="text-sm font-normal text-muted ml-1">/month</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
