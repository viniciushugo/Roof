import { useState, useRef, useMemo, useEffect } from 'react'
import { useScroll, motion, useMotionValue, useTransform, MotionValue } from 'framer-motion'
import { Heart } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../../components/layout/BottomNav'
import { useSaved } from '../../context/SavedContext'
import { useViewed } from '../../context/ViewedContext'
import { Listing } from '../../data/listings'
import { useListings } from '../../context/ListingsContext'
import ListingCard from '../../components/ui/ListingCard'
import ListingModal from '../../components/ui/ListingModal'

// ─── Opal-style horizontal carousel ──────────────────────────────────────────
// Adapted from github.com/make-it-animated/rn-makeitanimated (branch: public)
// Original uses react-native-reanimated; translated to Framer Motion for web.

const CAROUSEL_H_PADDING = 12
const TARGET_CARDS = 2
const PEEK_RATIO = 0.15
const INNER_PADDING = 6

function lerp(value: number, [i0, i1]: number[], [o0, o1]: number[]) {
  const t = Math.max(0, Math.min(1, (value - i0) / (i1 - i0)))
  return o0 + t * (o1 - o0)
}

function OpalCarouselItem({
  listing,
  index,
  scrollX,
  itemWidth,
  containerWidth,
  onClick,
}: {
  listing: Listing
  index: number
  scrollX: MotionValue<number>
  itemWidth: number
  containerWidth: number
  onClick: () => void
}) {
  const scale = useTransform(scrollX, (x) => {
    const center = (containerWidth - CAROUSEL_H_PADDING * 2) / 2
    const dist = Math.abs(index * itemWidth - x + itemWidth / 2 - center)
    if (dist <= itemWidth) return 1
    return lerp(dist, [itemWidth, itemWidth * 1.5], [1, 0.88])
  })

  const blurPx = useTransform(scrollX, (x) => {
    const center = (containerWidth - CAROUSEL_H_PADDING * 2) / 2
    const dist = Math.abs(index * itemWidth - x + itemWidth / 2 - center)
    if (dist <= itemWidth) return 0
    return lerp(dist, [itemWidth, itemWidth * 1.5], [0, 7])
  })

  const filter = useTransform(blurPx, (b) => (b > 0.2 ? `blur(${b}px)` : 'none'))

  return (
    <motion.div
      style={{ width: itemWidth, padding: INNER_PADDING, scale, flexShrink: 0 }}
      className="self-start cursor-pointer"
      onClick={onClick}
    >
      <motion.div
        style={{ filter }}
        className="relative rounded-3xl overflow-hidden"
      >
        {/* 2:3 aspect ratio */}
        <div style={{ paddingBottom: '150%' }} className="relative">
          <img
            src={listing.image}
            alt={listing.title}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/60 to-black" />
          <div className="absolute bottom-3 left-3 right-3">
            <p className="text-white font-bold text-[13px] truncate">{listing.neighborhood}</p>
            <p className="text-white/70 text-xs mt-0.5">€{listing.price.toLocaleString()}/mo</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function OpalCarousel({ listings, onSelect }: { listings: Listing[]; onSelect: (l: Listing) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(window.innerWidth)
  const scrollX = useMotionValue(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    setContainerWidth(el.clientWidth)
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const itemWidth = (containerWidth - CAROUSEL_H_PADDING * 2) / (TARGET_CARDS + PEEK_RATIO * 2)

  return (
    <div ref={containerRef}>
      <div
        className="flex overflow-x-auto scrollbar-hide"
        style={{ paddingLeft: CAROUSEL_H_PADDING, paddingRight: CAROUSEL_H_PADDING }}
        onScroll={(e) => scrollX.set(e.currentTarget.scrollLeft)}
      >
        {listings.map((listing, index) => (
          <OpalCarouselItem
            key={listing.id}
            listing={listing}
            index={index}
            scrollX={scrollX}
            itemWidth={itemWidth}
            containerWidth={containerWidth}
            onClick={() => onSelect(listing)}
          />
        ))}
      </div>
    </div>
  )
}

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
    () => listings.filter((l) => !savedIds.has(l.id) && l.image && l.image.startsWith('http')).slice(0, 10),
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

          {/* You may like — Opal-style horizontal carousel */}
          {tab === 'Liked' && suggestions.length > 0 && (
            <div className="pb-8">
              <div className="flex items-center justify-between mb-3 px-5">
                <h2 className="text-[17px] font-bold text-foreground">You may like</h2>
                <button
                  onClick={() => navigate('/app/rooms')}
                  className="text-sm font-medium text-muted active:opacity-60"
                >
                  View all
                </button>
              </div>
              <OpalCarousel listings={suggestions} onSelect={setActiveListing} />
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
