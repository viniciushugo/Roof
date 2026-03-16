import { memo } from 'react'
import { motion, MotionValue, useTransform } from 'framer-motion'
import { Home, Ruler } from 'lucide-react'
import { hapticLight } from '../../lib/haptics'
import { Listing } from '../../data/listings'
import SourceBadge from './SourceBadge'

// Angle step: divides a full circle (2π) into 10 segments ≈ 36° per step
// Controls how spread out items are on the arc
const ANGLE_STEP = (2 * Math.PI) / 10

interface Props {
  index: number
  listing: Listing
  animatedIndex: MotionValue<number>
  radius: number
  onTapActive: () => void
  onTapInactive: (index: number) => void
  isSaved: boolean
  onToggleSave: () => void
  isViewed: boolean
}

const CircularCarouselItem = memo(({
  index,
  listing,
  animatedIndex,
  radius,
  onTapActive,
  onTapInactive,
  isSaved,
  onToggleSave,
  isViewed,
}: Props) => {

  // ─── Circular path math ───────────────────────────────────────────────────
  // When animatedIndex === index → angle = -π/2 (top of circle, item is active)
  // As animatedIndex moves away, item rotates around the arc
  const angle = useTransform(
    animatedIndex,
    (aIdx) => -Math.PI / 2 + (aIdx - index) * ANGLE_STEP,
  )

  // X: -radius·cos(angle) — negative cosine moves items left as they advance
  const x = useTransform(angle, (a) => -radius * Math.cos(a))

  // Y: radius·sin(angle) — active item at -radius (above circle center), others lower
  const y = useTransform(angle, (a) => radius * Math.sin(a))

  // Scale: 1.0 at center → 0.72 at ±1 → clamped at 0.65 beyond ±2
  const scale = useTransform(animatedIndex, (aIdx) => {
    const diff = Math.abs(aIdx - index)
    if (diff > 2.5) return 0.45
    return Math.max(0.65, 1 - diff * 0.18)
  })

  // Rotate: counteracts circular rotation to keep card text upright
  // -angle - π/2 aligns the card face forward at every point on the arc
  const rotate = useTransform(angle, (a) => `${(-a - Math.PI / 2) * (180 / Math.PI)}deg`)

  // Opacity: fade out items beyond ±2 positions for clean culling
  const opacity = useTransform(animatedIndex, (aIdx) => {
    const diff = Math.abs(aIdx - index)
    if (diff > 2.1) return 0
    if (diff > 1.6) return Math.max(0, (2.1 - diff) / 0.5)
    return 1
  })

  // zIndex: active item always renders on top
  const zIndex = useTransform(animatedIndex, (aIdx) =>
    Math.max(0, Math.round(10 - Math.abs(aIdx - index) * 3)),
  )

  // ─── Tap handler ─────────────────────────────────────────────────────────
  const handleTap = () => {
    const isActive = Math.round(animatedIndex.get()) === index
    if (isActive) {
      hapticLight()
      onTapActive()
    } else {
      onTapInactive(index)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <motion.div
      className="absolute cursor-pointer"
      style={{
        // Base position: centered horizontally, anchored to the bottom of the container
        // Framer Motion x/y translate FROM this base along the circular arc
        width: '72%',
        bottom: 0,
        left: '50%',
        marginLeft: '-36%',
        x,
        y,
        scale,
        rotate,
        opacity,
        zIndex,
        willChange: 'transform',
        transformOrigin: 'center bottom',
      }}
      onClick={handleTap}
    >
      <div
        className="bg-background rounded-[24px] border border-border overflow-hidden"
        style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.10)' }}
      >
        {/* ── Image ── */}
        <div className="relative aspect-[16/9] bg-secondary flex items-center justify-center overflow-hidden">
          <Home size={26} strokeWidth={1.2} className="text-neutral-300 dark:text-neutral-600" />

          {listing.image && listing.image.startsWith('http') && (
            <img
              src={listing.image}
              alt={listing.title}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          )}

          {isViewed ? (
            <div className="absolute top-2.5 left-2.5">
              <span className="bg-black/50 backdrop-blur-sm text-white text-[10px] font-medium px-2.5 py-1 rounded-full uppercase tracking-wide">
                Viewed
              </span>
            </div>
          ) : listing.isNew ? (
            <div className="absolute top-2.5 left-2.5">
              <span className="bg-green-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                New
              </span>
            </div>
          ) : null}

          <button
            onClick={(e) => { e.stopPropagation(); hapticLight(); onToggleSave() }}
            className="absolute top-2.5 right-2.5 w-8 h-8 bg-background/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm active:scale-90 transition-transform text-foreground"
          >
            <svg
              width="14" height="14" viewBox="0 0 24 24"
              fill={isSaved ? 'currentColor' : 'none'}
              stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>

        {/* ── Info ── */}
        <div className="px-4 pt-3.5 pb-4">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <p className="text-[15px] font-semibold text-foreground leading-tight">
                {listing.neighborhood}
              </p>
              <p className="text-[22px] font-bold text-foreground mt-0.5">
                €{listing.price.toLocaleString()}
                <span className="text-xs font-normal text-muted">/mo</span>
              </p>
            </div>
            <SourceBadge source={listing.source} />
          </div>

          <div className="flex items-center gap-2.5 text-muted text-xs mt-2 flex-wrap">
            <span className="flex items-center gap-1">
              <Home size={11} strokeWidth={1.8} />
              {listing.type}
            </span>
            <span className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-600 flex-shrink-0" />
            <span className="flex items-center gap-1">
              <Ruler size={11} strokeWidth={1.8} />
              {listing.size}m²
            </span>
            <span className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-600 flex-shrink-0" />
            <span className="capitalize">{listing.furnished}</span>
            <span className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-600 flex-shrink-0" />
            <span>{listing.postedAt}</span>
          </div>

          {listing.description && (
            <p className="text-xs text-muted mt-2 line-clamp-2 leading-relaxed">
              {listing.description}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
})

CircularCarouselItem.displayName = 'CircularCarouselItem'
export default CircularCarouselItem
