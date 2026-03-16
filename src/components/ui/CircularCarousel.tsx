import { useEffect, useRef, useState, useCallback } from 'react'
import { animate, useMotionValue, useTransform, motion, PanInfo } from 'framer-motion'
import { Listing } from '../../data/listings'
import CircularCarouselItem from './CircularCarouselItem'

// ─── Spring physics ────────────────────────────────────────────────────────
// Tuned to match the original Alma circular carousel feel:
// Higher damping (54) prevents overshoot on the arc path
// Stiffness (300) gives responsive snapping without being jittery
// Mass (5.5) adds weight — transitions feel deliberate and smooth
const SPRING_CONFIG = {
  type: 'spring' as const,
  damping: 54,
  stiffness: 300,
  mass: 5.5,
}

// Auto-advance interval: 3s gives users enough time to read listing details
const ANIMATION_INTERVAL = 3000

// Max factor to extend listings before recycling (keeps memory bounded)
const MAX_EXTEND_FACTOR = 4

interface Props {
  listings: Listing[]
  onOpenListing: (listing: Listing) => void
  isSaved: (id: string) => boolean
  onToggleSave: (id: string) => void
  isViewed: (id: string) => boolean
}

export default function CircularCarousel({
  listings,
  onOpenListing,
  isSaved,
  onToggleSave,
  isViewed,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [radius, setRadius] = useState(280)

  // Extended slides enable infinite scrolling without visual gaps
  const [extendedListings, setExtendedListings] = useState<Listing[]>(listings)
  const infiniteLengthRef = useRef(listings.length)

  // animatedIndex drives all circular path calculations in child items
  // Starts at 1 so index 0 peeks in from the right on first render
  const animatedIndex = useMotionValue(1)

  // Rounded index — used to determine which item is active
  const currentIndex = useTransform(animatedIndex, (v) => Math.round(v))

  // ─── Measure container for radius ──────────────────────────────────────
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        // radius = slightly more than half the container height
        // creates a taller arc so the active item sits high in the view
        setRadius(containerRef.current.offsetHeight * 0.55)
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // ─── Reset when listings prop changes (filters applied) ────────────────
  useEffect(() => {
    setExtendedListings(listings)
    infiniteLengthRef.current = listings.length
    animatedIndex.set(1)
  }, [listings])

  // ─── Auto-advance ───────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const nextIdx = currentIndex.get() + 1
      const currentLength = infiniteLengthRef.current

      // Pre-append slides 2 positions before end so the loop is seamless
      if (nextIdx >= currentLength - 2) {
        setExtendedListings((prev) => {
          // Cap the total length to prevent unbounded memory growth
          if (prev.length >= listings.length * MAX_EXTEND_FACTOR) return prev
          const appended = [...prev, ...listings]
          infiniteLengthRef.current = appended.length
          return appended
        })
      }

      animate(animatedIndex, nextIdx, SPRING_CONFIG)
    }, ANIMATION_INTERVAL)

    return () => clearInterval(interval)
  }, [listings])

  // ─── Manual advance via tap on non-active item ─────────────────────────
  const advanceTo = useCallback((index: number) => {
    animate(animatedIndex, index, SPRING_CONFIG)
  }, [])

  // ─── Swipe gesture for manual browsing ─────────────────────────────────
  // Drag left = advance, drag right = go back
  const handleDragEnd = useCallback((_: PointerEvent, info: PanInfo) => {
    const SWIPE_THRESHOLD = 40 // px
    const VELOCITY_THRESHOLD = 200 // px/s
    const current = currentIndex.get()

    const shouldAdvance =
      info.offset.x < -SWIPE_THRESHOLD || info.velocity.x < -VELOCITY_THRESHOLD
    const shouldGoBack =
      info.offset.x > SWIPE_THRESHOLD || info.velocity.x > VELOCITY_THRESHOLD

    if (shouldAdvance) {
      const nextIdx = current + 1
      const currentLength = infiniteLengthRef.current
      if (nextIdx >= currentLength - 2) {
        setExtendedListings((prev) => {
          if (prev.length >= listings.length * MAX_EXTEND_FACTOR) return prev
          const appended = [...prev, ...listings]
          infiniteLengthRef.current = appended.length
          return appended
        })
      }
      animate(animatedIndex, nextIdx, SPRING_CONFIG)
    } else if (shouldGoBack && current > 0) {
      animate(animatedIndex, current - 1, SPRING_CONFIG)
    } else {
      // Snap back to current
      animate(animatedIndex, current, SPRING_CONFIG)
    }
  }, [listings])

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <motion.div
      ref={containerRef}
      className="relative w-full flex-1 overflow-hidden"
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.1}
      onDragEnd={handleDragEnd}
    >
      {extendedListings.map((listing, i) => (
        <CircularCarouselItem
          key={`${listing.id}-${i}`}
          index={i}
          listing={listing}
          animatedIndex={animatedIndex}
          radius={radius}
          onTapActive={() => onOpenListing(listing)}
          onTapInactive={advanceTo}
          isSaved={isSaved(listing.id)}
          onToggleSave={() => onToggleSave(listing.id)}
          isViewed={isViewed(listing.id)}
        />
      ))}

      {/* ── Hint ── */}
      <div className="absolute bottom-5 left-0 right-0 flex flex-col items-center gap-1 pointer-events-none">
        <p className="text-xs text-muted/60 font-medium">
          Swipe or tap to browse · {listings.length} listings
        </p>
      </div>
    </motion.div>
  )
}
