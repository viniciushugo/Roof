import { forwardRef, useRef, useEffect, useCallback, memo } from 'react'
import { motion, useMotionValue, useTransform, MotionValue } from 'framer-motion'
import { Home, Ruler } from 'lucide-react'
import { hapticLight } from '../../lib/haptics'
import { Listing } from '../../data/listings'
import SourceBadge from './SourceBadge'

const CARD_HEIGHT = 300

interface Props {
  listing: Listing
  index: number
  onClick: () => void
  isSaved: boolean
  onToggleSave: () => void
  scrollY?: MotionValue<number>
  isViewed?: boolean
}

const ListingCard = memo(forwardRef<HTMLDivElement, Props>(
  ({ listing, index, onClick, isSaved, onToggleSave, scrollY, isViewed }, externalRef) => {
    const internalRef = useRef<HTMLDivElement>(null)
    const cardTopRef = useRef(0)
    const defaultScrollY = useMotionValue(0)
    const effectiveScrollY = scrollY ?? defaultScrollY

    const setRef = useCallback(
      (node: HTMLDivElement | null) => {
        (internalRef as React.MutableRefObject<HTMLDivElement | null>).current = node
        if (typeof externalRef === 'function') externalRef(node)
        else if (externalRef) externalRef.current = node
      },
      [externalRef],
    )

    // Capture offsetTop once on mount and on resize
    useEffect(() => {
      const measure = () => {
        if (internalRef.current) cardTopRef.current = internalRef.current.offsetTop
      }
      measure()
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }, [])

    // Scale: 1.0 → 0.88 as card scrolls off the top of the feed
    const scrollScale = useTransform(effectiveScrollY, (y) => {
      if (!scrollY) return 1
      const progress = Math.max(0, Math.min(1, (y - cardTopRef.current) / CARD_HEIGHT))
      return 1 - progress * 0.12
    })

    return (
      <motion.div
        ref={setRef}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.28, ease: 'easeOut' }}
        onClick={onClick}
        style={{
          scale: scrollScale,
          transformOrigin: 'top center',
          willChange: 'transform',
        }}
        className="bg-white rounded-3xl border border-border overflow-hidden shadow-xs cursor-pointer"
      >
        {/* Image */}
        <div className="relative aspect-[16/9] overflow-hidden bg-secondary flex items-center justify-center">
          {listing.image && listing.image.startsWith('http') ? (
            <img
              src={listing.image}
              alt={listing.title}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                const t = e.currentTarget
                t.onerror = null
                t.style.display = 'none'
              }}
            />
          ) : (
            <Home size={28} strokeWidth={1.2} className="text-neutral-300" />
          )}
          {isViewed ? (
            <div className="absolute top-3 left-3">
              <span className="bg-black/50 backdrop-blur-sm text-white text-[10px] font-medium px-2.5 py-1 rounded-full uppercase tracking-wide">
                Viewed
              </span>
            </div>
          ) : listing.isNew ? (
            <div className="absolute top-3 left-3">
              <span className="bg-green-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                New
              </span>
            </div>
          ) : null}
          <button
            onClick={(e) => {
              e.stopPropagation()
              hapticLight()
              onToggleSave()
            }}
            data-tour="save"
            className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-xs active:scale-90 transition-transform"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill={isSaved ? '#0a0a0a' : 'none'}
              stroke="#0a0a0a"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>

        {/* Info */}
        <div className="px-4 pt-4 pb-5">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div>
              <p className="text-[17px] font-semibold text-foreground leading-tight">
                {listing.neighborhood}
              </p>
              <p className="text-2xl font-bold text-foreground mt-0.5">
                €{listing.price.toLocaleString()}
                <span className="text-sm font-normal text-muted">/mo</span>
              </p>
            </div>
            <SourceBadge source={listing.source} />
          </div>

          <div className="flex items-center gap-3 text-muted text-sm mt-2 flex-wrap">
            <span className="flex items-center gap-1">
              <Home size={13} strokeWidth={1.8} />
              {listing.type}
            </span>
            <span className="w-1 h-1 rounded-full bg-neutral-300 flex-shrink-0" />
            <span className="flex items-center gap-1">
              <Ruler size={13} strokeWidth={1.8} />
              {listing.size}m²
            </span>
            <span className="w-1 h-1 rounded-full bg-neutral-300 flex-shrink-0" />
            <span className="capitalize">{listing.furnished}</span>
            <span className="w-1 h-1 rounded-full bg-neutral-300 flex-shrink-0" />
            <span>{listing.postedAt}</span>
          </div>

          <p className="text-sm text-muted mt-2 line-clamp-2 leading-relaxed">
            {listing.description}
          </p>
        </div>
      </motion.div>
    )
  },
))

ListingCard.displayName = 'ListingCard'
export default ListingCard
