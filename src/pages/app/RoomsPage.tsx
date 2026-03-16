import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { usePersistedState } from '../../hooks/usePersistedState'
// framer-motion scroll only
import { MapPin, Layers, Filter } from 'lucide-react'
import { useScroll } from 'framer-motion'
import { Listing } from '../../data/listings'
import { useListings } from '../../context/ListingsContext'
import BottomNav from '../../components/layout/BottomNav'
import { useSaved } from '../../context/SavedContext'
import { useViewed } from '../../context/ViewedContext'
import { useAlerts, alertMatchesListing } from '../../context/AlertsContext'
import { useAppRating } from '../../hooks/useAppRating'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { useOnboarding } from '../../hooks/useOnboarding'
import OnboardingTour from '../../components/ui/OnboardingTour'
import FiltersSheet, {
  ActiveFilters,
  DEFAULT_FILTERS,
  countActiveFilters,
} from '../../components/ui/FiltersSheet'
import CityPickerSheet from '../../components/ui/CityPickerSheet'
import ListingCard from '../../components/ui/ListingCard'
import ListingCardSkeleton from '../../components/ui/ListingCardSkeleton'
import ListingModal from '../../components/ui/ListingModal'
import PullToRefresh from '../../components/ui/PullToRefresh'
import CatchUpView from '../../components/ui/CatchUpView'
import { track } from '../../lib/analytics'

const PLATFORM_FILTERS = ['All', 'Pararius', 'Kamernet', 'Huurwoningen', 'HousingAnywhere', 'DirectWonen', 'Rentola', 'Kamer.nl', 'Huurstunt', '123Wonen', 'Funda'] as const
type PlatformFilter = typeof PLATFORM_FILTERS[number]

export default function RoomsPage() {
  const [platformFilter, setPlatformFilter] = usePersistedState<PlatformFilter>('roof-platform-filter', 'All')
  const [showFilters, setShowFilters] = useState(false)
  const [showCityPicker, setShowCityPicker] = useState(false)
  const [showCatchUp, setShowCatchUp] = useState(false)
  const [filters, setFilters] = usePersistedState<ActiveFilters>('roof-active-filters', DEFAULT_FILTERS)
  const [selectedCities, setSelectedCities] = usePersistedState<string[]>('roof-selected-cities', [])
  const [activeListing, setActiveListing] = useState<Listing | null>(null)
  const { isSaved, toggleSave } = useSaved()
  const { listings, loading, refresh } = useListings()

  // Derived from real Supabase data — no dummy fallbacks
  const allCities = useMemo(() => [...new Set(listings.map((l) => l.city))].sort(), [listings])
  const allNeighborhoods = useMemo(() => [...new Set(listings.map((l) => l.neighborhood).filter(Boolean))].sort(), [listings])
  const { isViewed, markViewed } = useViewed()
  const { alerts } = useAlerts()
  const { showTour, completeTour, skipTour } = useOnboarding()
  useAppRating()
  const handlePushOpen = useCallback((listingId: string) => {
    const listing = listings.find((l) => l.id === listingId)
    if (listing) setActiveListing(listing)
  }, [listings])
  usePushNotifications(handlePushOpen)

  const feedRef = useRef<HTMLDivElement>(null)
  const { scrollY } = useScroll({ container: feedRef })

  // Pre-filter by alerts criteria (if user has alerts, only show matching listings)
  const alertFiltered = alerts.length > 0
    ? listings.filter((l) => alerts.some((a) => alertMatchesListing(a, l)))
    : listings

  // Reset scroll when any filter changes
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = 0
  }, [platformFilter, filters, selectedCities])

  // Track filter changes
  const handleFiltersChange = useCallback((next: ActiveFilters) => {
    setFilters(next)
    track('filter_applied', { filters: next })
  }, [])

  // Track platform chip selection
  const handlePlatformFilter = useCallback((p: PlatformFilter) => {
    setPlatformFilter(p)
    if (p !== 'All') track('source_filtered', { source: p })
  }, [])

  const activeFilterCount = countActiveFilters(filters)

  const cityLabel =
    selectedCities.length === 0
      ? 'All cities'
      : selectedCities.length === 1
      ? selectedCities[0]
      : `${selectedCities[0]} +${selectedCities.length - 1}`

  const filtered = alertFiltered.filter((l) => {
    if (selectedCities.length > 0 && !selectedCities.includes(l.city)) return false
    if (platformFilter !== 'All' && l.source !== platformFilter) return false
    if (filters.priceMin && l.price < parseInt(filters.priceMin)) return false
    if (filters.priceMax && l.price > parseInt(filters.priceMax)) return false
    if (filters.sizeMin && l.size < parseInt(filters.sizeMin)) return false
    if (filters.sizeMax && l.size > parseInt(filters.sizeMax)) return false
    if (filters.rooms.length > 0) {
      const matches = filters.rooms.some((r) => (r === 4 ? l.rooms >= 4 : l.rooms === r))
      if (!matches) return false
    }
    if (filters.furnished !== 'all' && l.furnished !== filters.furnished) return false
    if (filters.neighborhoods.length > 0 && !filters.neighborhoods.includes(l.neighborhood)) return false
    return true
  })

  const newCount = filtered.filter((l) => l.isNew).length

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-14 pb-3 bg-background">
        <div className="flex items-center justify-between mb-4">
          <div>
            <button
              onClick={() => setShowCityPicker(true)}
              className="flex items-center gap-1.5 text-[15px] font-medium text-foreground active:opacity-60 transition-opacity"
            >
              <MapPin size={15} strokeWidth={2} />
              {cityLabel} <span className="text-base">🇳🇱</span>
            </button>
            <p className="text-xs text-muted mt-0.5">
              Listings from 10 platforms across the Netherlands
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(true)}
              className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                activeFilterCount > 0
                  ? 'bg-foreground text-background'
                  : 'bg-secondary text-foreground'
              }`}
            >
              <Filter size={16} strokeWidth={1.8} />
              {activeFilterCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 border-2 border-background text-white text-[9px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowCatchUp(true)}
              data-tour="catchup"
              className="relative w-9 h-9 bg-secondary rounded-full flex items-center justify-center"
            >
              <Layers size={16} strokeWidth={1.8} className="text-foreground" />
              {newCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-background" />
              )}
            </button>
          </div>
        </div>

        {/* Platform filter chips */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
          {PLATFORM_FILTERS.map((p) => {
            const count = p === 'All'
              ? alertFiltered.length
              : alertFiltered.filter((l) => l.source === p).length
            return (
              <button
                key={p}
                onClick={() => handlePlatformFilter(p)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  platformFilter === p
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-background text-foreground border-border'
                }`}
              >
                {p} · {count}
              </button>
            )
          })}
        </div>
      </div>

      {/* New listings badge */}
      <div className="px-5 pb-2 flex items-center gap-2 flex-shrink-0">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-xs text-muted font-medium">
          {filtered.filter((l) => l.isNew).length} new in the last 24h
        </span>
        {filtered.length !== alertFiltered.length && (
          <span className="text-xs text-muted">· {filtered.length} matching</span>
        )}
      </div>

      {/* Listings feed with pull-to-refresh */}
      <PullToRefresh onRefresh={refresh} scrollRef={feedRef}>
        <div className="min-h-full pb-4 flex flex-col">
          {loading ? (
            <div className="px-5 space-y-4 pt-2">
              {[0, 1, 2].map((i) => (
                <ListingCardSkeleton key={i} />
              ))}
            </div>
          ) : platformFilter === 'Funda' ? (
            <div className="flex flex-col flex-1 items-center justify-center gap-3 px-8 text-center">
              <div className="w-14 h-14 bg-orange-50 dark:bg-orange-950 rounded-3xl flex items-center justify-center text-2xl">
                🏗
              </div>
              <div>
                <p className="text-[15px] font-semibold text-foreground mb-1">Coming soon!</p>
                <p className="text-sm text-muted leading-relaxed">
                  Funda charges for external search on their platform. We're working on making this happen — stay tuned!
                </p>
              </div>
              <button
                onClick={() => setPlatformFilter('All')}
                className="mt-1 px-5 h-10 bg-foreground text-background rounded-full text-sm font-medium"
              >
                Browse all listings
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col flex-1 items-center justify-center gap-3 px-8 text-center">
              <div className="w-14 h-14 bg-secondary rounded-3xl flex items-center justify-center">
                <Filter size={22} strokeWidth={1.5} className="text-muted" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-foreground mb-1">No listings match</p>
                <p className="text-sm text-muted">Try adjusting or resetting your filters.</p>
              </div>
              <button
                onClick={() => {
                  setFilters(DEFAULT_FILTERS)
                  setSelectedCities([])
                  setPlatformFilter('All')
                }}
                className="mt-1 px-5 h-10 bg-foreground text-background rounded-full text-sm font-medium"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="px-5 space-y-4 pt-2">
              {filtered.map((listing, i) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    index={i}
                    onClick={() => setActiveListing(listing)}
                    isSaved={isSaved(listing.id)}
                    onToggleSave={() => toggleSave(listing.id)}
                    scrollY={scrollY}
                    isViewed={isViewed(listing.id)}
                  />
                ))}
            </div>
          )}
        </div>
      </PullToRefresh>

      <BottomNav />

      <FiltersSheet
        open={showFilters}
        filters={filters}
        neighborhoods={allNeighborhoods}
        onChange={handleFiltersChange}
        onClose={() => setShowFilters(false)}
        onReset={() => setFilters(DEFAULT_FILTERS)}
      />

      <CityPickerSheet
        open={showCityPicker}
        cities={allCities}
        selectedCities={selectedCities}
        onChange={setSelectedCities}
        onClose={() => setShowCityPicker(false)}
      />

      <CatchUpView
        open={showCatchUp}
        onClose={() => setShowCatchUp(false)}
        onOpenListing={(l) => setActiveListing(l)}
      />

      <ListingModal listing={activeListing} onClose={() => setActiveListing(null)} onViewed={markViewed} />

      {showTour && <OnboardingTour onComplete={completeTour} onSkip={skipTour} />}
    </div>
  )
}
