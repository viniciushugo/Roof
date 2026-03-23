import { createContext, useContext, useState, ReactNode } from 'react'
import { storage } from '../lib/storage'

const STORAGE_KEY = 'roof-onboarding-data'

interface OnboardingData {
  name: string
  purposes: string[]
  housingType: string
  country: string
  cities: string[]
  budgetMin: number
  budgetMax: number
  interests: string[]
  sizeMin: number
  sizeMax: number
  bedrooms: number[]
  interior: string
}

interface OnboardingContextType {
  data: Partial<OnboardingData>
  setData: (updates: Partial<OnboardingData>) => void
}

const OnboardingContext = createContext<OnboardingContextType>({
  data: {},
  setData: () => {},
})

function loadData(): Partial<OnboardingData> {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Partial<OnboardingData>
  } catch {}
  return {}
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [data, setDataState] = useState<Partial<OnboardingData>>(loadData)

  const setData = (updates: Partial<OnboardingData>) => {
    setDataState((prev) => {
      const next = { ...prev, ...updates }
      storage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  return (
    <OnboardingContext.Provider value={{ data, setData }}>
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  return useContext(OnboardingContext)
}
