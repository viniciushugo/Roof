export interface Listing {
  id: string
  title: string
  neighborhood: string
  city: string
  price: number
  type: 'Private room' | 'Studio' | 'Apartment' | 'Shared room'
  size: number
  rooms: number
  furnished: 'furnished' | 'unfurnished' | 'upholstered'
  source: 'Pararius' | 'Kamernet' | 'Huurwoningen' | 'Funda' | 'HousingAnywhere' | 'DirectWonen' | 'Rentola' | 'Kamer.nl' | 'Huurstunt' | '123Wonen'
  url: string
  image: string
  images: string[]
  availableFrom: string
  isNew: boolean
  postedAt: string
  postedAtRaw: string
  description: string
  lat: number | null
  lng: number | null
  addressRaw: string | null
  addressPrecision: 'exact' | 'postcode' | 'neighbourhood' | 'city' | null
}

export const sourceColors: Record<Listing['source'], string> = {
  Pararius: '#1B4FFF',
  Kamernet: '#E84B3C',
  Huurwoningen: '#00B090',
  Funda: '#F97316',
  HousingAnywhere: '#7C3AED',
  DirectWonen: '#0891B2',
  Rentola: '#D946EF',
  'Kamer.nl': '#F59E0B',
  Huurstunt: '#14B8A6',
  '123Wonen': '#6366F1',
}

