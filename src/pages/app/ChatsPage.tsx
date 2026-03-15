import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, MapPin, Home, X, Bell, Pencil } from 'lucide-react'
import BottomNav from '../../components/layout/BottomNav'
import AlertSheet from '../../components/ui/AlertSheet'
import ListingModal from '../../components/ui/ListingModal'
import { useAlerts, Alert, alertMatchesListing } from '../../context/AlertsContext'
import { useOnboarding } from '../../context/OnboardingContext'
import { Listing } from '../../data/listings'
import { useListings } from '../../context/ListingsContext'

const FEED_FILTERS = ['All', 'Your alerts', 'New matches'] as const
type FeedFilter = typeof FEED_FILTERS[number]

const SOURCE_BADGE_BG: Record<string, string> = {
  Pararius: 'bg-blue-50',
  Kamernet: 'bg-red-50',
  Huurwoningen: 'bg-emerald-50',
  Funda: 'bg-orange-50',
  HousingAnywhere: 'bg-purple-50',
  DirectWonen: 'bg-cyan-50',
  Rentola: 'bg-fuchsia-50',
  'Kamer.nl': 'bg-amber-50',
  Huurstunt: 'bg-teal-50',
  '123Wonen': 'bg-indigo-50',
}

export default function AlertsPage() {
  const { alerts, addAlert, updateAlert, removeAlert, markAllRead } = useAlerts()
  const { data } = useOnboarding()
  const { listings } = useListings()
  const [showSheet, setShowSheet] = useState(false)
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null)
  const [activeListing, setActiveListing] = useState<Listing | null>(null)
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('All')
  const [showBanner, setShowBanner] = useState(true)

  useEffect(() => {
    markAllRead()
  }, [markAllRead])

  const newMatches = useMemo(
    () => listings.filter((l) => l.isNew && alerts.some((a) => alertMatchesListing(a, l))),
    [listings, alerts],
  )

  // Group new matches by time
  const groupedMatches = useMemo(() => {
    const today: Listing[] = []
    const earlier: Listing[] = []
    newMatches.forEach((l) => {
      if (l.postedAt.includes('m ago') || l.postedAt.includes('h ago')) today.push(l)
      else earlier.push(l)
    })
    return { today, earlier }
  }, [newMatches])

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Header — left-aligned, consistent */}
      <div className="flex-shrink-0 px-5 pt-14 pb-3">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold text-foreground">Alerts</h1>
          <button
            onClick={() => setShowSheet(true)}
            className="flex items-center gap-1.5 h-9 px-4 bg-foreground text-white rounded-full text-sm font-semibold active:opacity-75 transition-opacity"
          >
            <Plus size={14} strokeWidth={2.5} />
            New
          </button>
        </div>
        <p className="text-sm text-muted mb-4">
          {alerts.length > 0
            ? `${alerts.length} active alert${alerts.length !== 1 ? 's' : ''}`
            : 'Get notified for new listings'}
        </p>

        {/* Filter chips */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {FEED_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFeedFilter(f)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                feedFilter === f
                  ? 'bg-foreground text-white border-foreground'
                  : 'bg-white text-foreground border-border'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Promo banner — like Coinbase "Set up custom alerts" */}
        {showBanner && alerts.length === 0 && feedFilter !== 'Your alerts' && (
          <div className="mx-5 mt-4 bg-secondary rounded-2xl p-4 relative">
            <button
              onClick={() => setShowBanner(false)}
              className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center active:opacity-60"
            >
              <X size={14} strokeWidth={2} className="text-muted" />
            </button>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-[15px] font-semibold text-foreground mb-1">Set up custom alerts</p>
                <p className="text-sm text-muted leading-relaxed">
                  Get notified when a listing matching your criteria is posted
                </p>
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Bell size={22} strokeWidth={1.5} className="text-amber-500" />
              </div>
            </div>
            <button
              onClick={() => setShowSheet(true)}
              className="mt-3 h-9 px-4 bg-foreground text-white rounded-full text-sm font-semibold active:opacity-75 transition-opacity"
            >
              Create alert
            </button>
          </div>
        )}

        {/* Your alerts section — shown first */}
        {(feedFilter === 'All' || feedFilter === 'Your alerts') && alerts.length > 0 && (
          <div className="px-5 pt-5 pb-8">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
              Your alerts
            </p>
            <AnimatePresence mode="popLayout">
              {alerts.map((alert, i) => {
                const matchCount = listings.filter((l) => alertMatchesListing(alert, l)).length
                const newCount = listings.filter(
                  (l) => l.isNew && alertMatchesListing(alert, l),
                ).length

                return (
                  <motion.div
                    key={alert.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ delay: i * 0.04, duration: 0.25 }}
                    className="mb-3 bg-white border border-border rounded-2xl p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[15px] font-semibold text-foreground truncate">
                            {alert.name}
                          </p>
                          {alert.isMain && (
                            <span className="flex-shrink-0 bg-foreground text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                              Main
                            </span>
                          )}
                          {newCount > 0 && (
                            <span className="flex-shrink-0 bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                              {newCount} new
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {alert.cities.map((city) => (
                            <span
                              key={city}
                              className="flex items-center gap-1 px-2.5 h-7 bg-secondary rounded-full text-[12px] font-medium text-foreground"
                            >
                              <MapPin size={10} strokeWidth={2} />
                              {city}
                            </span>
                          ))}
                          {alert.housingType !== 'all' && (
                            <span className="flex items-center gap-1 px-2.5 h-7 bg-secondary rounded-full text-[12px] font-medium text-foreground">
                              <Home size={10} strokeWidth={2} />
                              {alert.housingType}
                            </span>
                          )}
                          {(alert.budgetMin > 0 || alert.budgetMax > 0) && (
                            <span className="px-2.5 h-7 bg-secondary rounded-full text-[12px] font-medium text-foreground flex items-center">
                              {alert.budgetMin > 0 && alert.budgetMax > 0
                                ? `€${alert.budgetMin.toLocaleString()}–€${alert.budgetMax.toLocaleString()}`
                                : alert.budgetMax > 0
                                ? `≤ €${alert.budgetMax.toLocaleString()}`
                                : `≥ €${alert.budgetMin.toLocaleString()}`}
                            </span>
                          )}
                        </div>
                        <p className="text-[13px] text-muted mt-2">
                          {matchCount} listing{matchCount !== 1 ? 's' : ''} match
                          {matchCount === 1 ? 'es' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => { setEditingAlert(alert); setShowSheet(true) }}
                          className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center active:opacity-60"
                        >
                          <Pencil size={13} strokeWidth={1.8} className="text-muted" />
                        </button>
                        {!alert.isMain && (
                          <button
                            onClick={() => removeAlert(alert.id)}
                            className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center active:opacity-60"
                          >
                            <Trash2 size={13} strokeWidth={1.8} className="text-muted" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}

        {/* New matches section — shown after alerts */}
        {(feedFilter === 'All' || feedFilter === 'New matches') && (
          <>
            {newMatches.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
                <div className="w-14 h-14 bg-secondary rounded-3xl flex items-center justify-center">
                  <Bell size={22} strokeWidth={1.5} className="text-muted" />
                </div>
                <p className="text-[15px] font-semibold text-foreground">No new matches</p>
                <p className="text-sm text-muted">
                  {alerts.length === 0
                    ? 'Create an alert to start receiving matches.'
                    : 'New listings matching your alerts will appear here.'}
                </p>
              </div>
            ) : (
              <>
                {/* Today's matches */}
                {groupedMatches.today.length > 0 && (
                  <div>
                    <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted uppercase tracking-wide">
                        New matches
                      </p>
                      <span className="text-xs text-muted">Today</span>
                    </div>
                    {groupedMatches.today.map((listing) => (
                      <button
                        key={listing.id}
                        onClick={() => setActiveListing(listing)}
                        className="w-full flex items-center gap-3.5 px-5 py-3.5 active:bg-secondary transition-colors"
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${SOURCE_BADGE_BG[listing.source] ?? 'bg-secondary'}`}>
                          <Home size={16} strokeWidth={1.8} className="text-foreground" />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-xs font-medium text-muted">
                            {listing.source}
                          </p>
                          <p className="text-[15px] text-foreground mt-0.5 leading-snug">
                            {listing.neighborhood} — €{listing.price.toLocaleString()}/mo · {listing.type}
                          </p>
                        </div>
                        <span className="text-xs text-muted flex-shrink-0">{listing.postedAt}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Earlier matches */}
                {groupedMatches.earlier.length > 0 && (
                  <div>
                    <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted uppercase tracking-wide">
                        Earlier
                      </p>
                    </div>
                    {groupedMatches.earlier.map((listing) => (
                      <button
                        key={listing.id}
                        onClick={() => setActiveListing(listing)}
                        className="w-full flex items-center gap-3.5 px-5 py-3.5 active:bg-secondary transition-colors"
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${SOURCE_BADGE_BG[listing.source] ?? 'bg-secondary'}`}>
                          <Home size={16} strokeWidth={1.8} className="text-foreground" />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-xs font-medium text-muted">
                            {listing.source}
                          </p>
                          <p className="text-[15px] text-foreground mt-0.5 leading-snug">
                            {listing.neighborhood} — €{listing.price.toLocaleString()}/mo · {listing.type}
                          </p>
                        </div>
                        <span className="text-xs text-muted flex-shrink-0">{listing.postedAt}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Empty state for "Your alerts" filter with no alerts */}
        {feedFilter === 'Your alerts' && alerts.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 px-8 py-16 text-center">
            <div className="w-16 h-16 bg-secondary rounded-3xl flex items-center justify-center">
              <Bell size={28} strokeWidth={1.5} className="text-muted" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">No alerts yet</h3>
              <p className="text-sm text-muted leading-relaxed">
                Create an alert and we'll notify you instantly when new listings are posted.
              </p>
            </div>
            <button
              onClick={() => setShowSheet(true)}
              className="flex items-center gap-2 h-12 px-6 bg-foreground text-white rounded-full text-[15px] font-semibold active:opacity-75 transition-opacity"
            >
              <Plus size={16} strokeWidth={2.5} />
              Create your first alert
            </button>
          </div>
        )}
      </div>

      <BottomNav />

      <AlertSheet
        open={showSheet}
        onClose={() => { setShowSheet(false); setEditingAlert(null) }}
        onSave={addAlert}
        onUpdate={updateAlert}
        editAlert={editingAlert}
        initialCities={data.cities ?? []}
      />

      <ListingModal listing={activeListing} onClose={() => setActiveListing(null)} />
    </div>
  )
}
