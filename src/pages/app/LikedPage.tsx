import { useState, useRef, useMemo } from 'react'
import { useScroll } from 'framer-motion'
import { Heart } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../../components/layout/BottomNav'
import { useSaved } from '../../context/SavedContext'
import { useViewed } from '../../context/ViewedContext'
import { Listing } from '../../data/listings'
import { useListings } from '../../context/ListingsContext'
import ListingCard from '../../components/ui/ListingCard'
import ListingModal from '../../components/ui/ListingModal'
import SourceBadge from '../../components/ui/SourceBadge'

const TABS = ['Liked', 'Viewed'] as const
type Tab = typeof TABS[number]

export default function LikedPage() {
  const navigate = useNavigate()
  const { savedIds, toggleSave, isSaved } = useSaved()
  const { listings } = useListings()
  const { isViewed, markViewed, viewedIds } = useViewed()
  const [activeListing, setActiveListing] = useState<Listing | null>(null)
  const [tab, setTab] = useState<Tab>('Liked')

  const liked = useMemo(() => listings.filter((l) => savedIds.has(l.id)), [listings, savedIds])
  const viewed = useMemo(() => listings.filter((l) => viewedIds.has(l.id)), [listings, viewedIds])

  const feedRef = useRef<HTMLDivElement>(null)
  const { scrollY } = useScroll({ container: feedRef })

  const suggestions = useMemo(
    () => listings.filter((l) => !savedIds.has(l.id) && l.image && l.image.startsWith('http')).slice(0, 6),
    [listings, savedIds],
  )

  const activeList = tab === 'Liked' ? liked : viewed
  const count = (t: Tab) => t === 'Liked' ? liked.length : viewed.length

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header — left-aligned, consistent with other tab pages */}
      <div className="flex-shrink-0 px-5 pt-header pb-3">
        <h1 className="text-2xl font-bold text-foreground">Liked</h1>
        <p className="text-sm text-muted mt-1">
          {liked.length > 0
            ? `${liked.length} listing${liked.length !== 1 ? 's' : ''} liked`
            : 'Listings you like will appear here'}
        </p>

        {/* Pill chip tabs — same style as Roof page platform filters */}
        <div className="flex items-center gap-2 mt-4 overflow-x-auto scrollbar-hide">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                tab === t
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-background text-foreground border-border'
              }`}
            >
              {t}{count(t) > 0 ? ` (${count(t)})` : ''}
            </button>
          ))}
        </div>
      </div>

      {activeList.length === 0 ? (
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {/* Empty state */}
          <div className="flex flex-col items-center justify-center gap-4 px-8 pt-16 pb-8 text-center">
            <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center">
              <Heart size={32} strokeWidth={1.2} className="text-neutral-300" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground mb-1">
                {tab === 'Liked' ? 'No likes yet' : 'No viewed listings'}
              </h3>
              <p className="text-sm text-muted leading-relaxed">
                {tab === 'Liked'
                  ? 'Like your favourite listings and find them here later'
                  : 'Listings you open will appear here'}
              </p>
            </div>
            <button
              onClick={() => navigate('/app/rooms')}
              className="px-6 h-11 bg-secondary text-foreground rounded-xl text-sm font-semibold active:opacity-75 transition-opacity"
            >
              Go browsing
            </button>
          </div>

          {/* You may like section */}
          {tab === 'Liked' && suggestions.length > 0 && (
            <div className="px-5 pb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[17px] font-bold text-foreground">You may like</h2>
                <button
                  onClick={() => navigate('/app/rooms')}
                  className="text-sm font-medium text-muted active:opacity-60"
                >
                  View all
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {suggestions.slice(0, 4).map((listing) => (
                  <button
                    key={listing.id}
                    onClick={() => setActiveListing(listing)}
                    className="bg-secondary rounded-2xl overflow-hidden text-left active:opacity-80 transition-opacity"
                  >
                    <div className="aspect-square overflow-hidden">
                      <img
                        src={listing.image}
                        alt={listing.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-semibold text-foreground truncate">{listing.neighborhood}</p>
                      <p className="text-sm text-muted mt-0.5">€{listing.price.toLocaleString()}/mo</p>
                      <div className="mt-2">
                        <SourceBadge source={listing.source} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div ref={feedRef} className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="px-5 py-4 space-y-4">
            {activeList.map((listing, i) => (
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
        </div>
      )}

      <BottomNav />

      <ListingModal listing={activeListing} onClose={() => setActiveListing(null)} onViewed={markViewed} />
    </div>
  )
}
