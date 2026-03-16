import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
  motion,
  MotionValue,
  useMotionValue,
  useTransform,
  animate,
  AnimatePresence,
} from 'framer-motion'
import { X, Undo2, Bookmark, SkipForward, Home, Sparkles, Ruler } from 'lucide-react'
import { Listing } from '../../data/listings'
import { useListings } from '../../context/ListingsContext'
import { useSaved } from '../../context/SavedContext'

// ─── Source badge colours ────────────────────────────────────────────────────
const SOURCE_COLORS: Record<string, string> = {
  Pararius:        'bg-blue-500/90 text-white',
  Kamernet:        'bg-red-500/90 text-white',
  Huurwoningen:    'bg-emerald-500/90 text-white',
  Funda:           'bg-orange-500/90 text-white',
  HousingAnywhere: 'bg-purple-500/90 text-white',
  DirectWonen:     'bg-cyan-500/90 text-white',
  Rentola:         'bg-fuchsia-500/90 text-white',
  'Kamer.nl':      'bg-amber-500/90 text-white',
  Huurstunt:       'bg-teal-500/90 text-white',
  '123Wonen':      'bg-indigo-500/90 text-white',
}

// ─── Swipe constants ─────────────────────────────────────────────────────────
const SWIPE_THRESHOLD  = 80
const VELOCITY_THRESHOLD = 400

// ─── Arc fan math ─────────────────────────────────────────────────────────────
// Cards fan to the right along a circular arc.
// ANGLE_STEP controls how spread-out each successive card is (radians).
const ANGLE_STEP = (2 * Math.PI) / 9   // ≈ 40° per step

// Returns the Framer Motion translate/scale/rotate for a card at `stackIndex`
// positions behind the top card. `radius` is half the container width.
function arcOffset(stackIndex: number, radius: number) {
  if (stackIndex === 0) return { x: 0, y: 0, scale: 1, rotate: 0 }

  const angle     = -Math.PI / 2 + stackIndex * ANGLE_STEP
  // Active card sits at angle -π/2; we compute dx/dy relative to that position
  const activeX   = -radius * Math.cos(-Math.PI / 2)  // = 0
  const activeY   =  radius * Math.sin(-Math.PI / 2)  // = -radius
  const cardX     = -radius * Math.cos(angle)
  const cardY     =  radius * Math.sin(angle)

  // Negate dx so upcoming cards fan to the RIGHT
  const dx        = -(cardX - activeX)
  const dy        =  (cardY - activeY)
  const scale     = Math.max(0.60, 1 - stackIndex * 0.13)
  const rotate    = stackIndex * 4.5           // gentle tilt, stays readable

  return { x: dx, y: dy, scale, rotate }
}

/* ─── Card component ─────────────────────────────────────────────────────────
   The card is NO LONGER inset-0. It floats in the container with generous
   horizontal margins, giving it the lifted, premium Alma-app feel.

   Top card: draggable left/right with skip/save overlays (unchanged UX).
   Background cards: arc-fanned via Framer Motion animate.
*/
interface CardProps {
  listing: Listing
  isTop: boolean
  stackIndex: number
  topX: MotionValue<number>
  radius: number
  onPanEnd: (e: PointerEvent, info: { offset: { x: number }; velocity: { x: number } }) => void
  onTap: () => void
}

function CatchUpCard({ listing, isTop, stackIndex, topX, radius, onPanEnd, onTap }: CardProps) {
  const hasDragged = useRef(false)

  // Top-card drag effects
  const dragRotate  = useTransform(topX, [-200, 200], [-10, 10])
  const saveOpacity = useTransform(topX, [0, SWIPE_THRESHOLD], [0, 1])
  const skipOpacity = useTransform(topX, [-SWIPE_THRESHOLD, 0], [1, 0])

  const { x, y, scale, rotate } = arcOffset(stackIndex, radius)

  return (
    <motion.div
      // ── Positioned card: floats with side padding, does NOT span edge-to-edge ──
      className="absolute"
      style={
        isTop
          ? {
              // Top card: only topX / dragRotate drive position — arc is identity (0,0)
              x: topX,
              rotate: dragRotate,
              zIndex: 10,
              touchAction: 'none',
              // Card geometry
              width:      '84%',
              left:       '8%',
              top:        '4%',
              bottom:     '4%',
            }
          : { zIndex: 10 - stackIndex, width: '84%', left: '8%', top: '4%', bottom: '4%' }
      }
      initial={false}
      animate={
        isTop
          ? { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 }
          : { x, y, scale, rotate, opacity: stackIndex < 4 ? 1 : 0 }
      }
      transition={
        isTop
          ? { duration: 0 }          // instant reset when a new card takes the top spot
          : { type: 'spring', stiffness: 260, damping: 26 }
      }
      onPanStart={isTop ? () => { hasDragged.current = false } : undefined}
      onPan={
        isTop
          ? (_, info) => {
              topX.set(info.offset.x)
              if (Math.abs(info.offset.x) > 3) hasDragged.current = true
            }
          : undefined
      }
      onPanEnd={isTop ? onPanEnd : undefined}
    >
      {/* ── The floating card shell ── */}
      <div
        className="w-full h-full bg-background flex flex-col overflow-hidden"
        style={{
          borderRadius: 32,
          boxShadow: isTop
            ? '0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)'
            : '0 12px 40px rgba(0,0,0,0.12)',
          willChange: 'transform',
        }}
        onClick={() => { if (isTop && !hasDragged.current) onTap() }}
      >

        {/* ── Image section (fills top ~60%) ── */}
        <div className="relative bg-secondary overflow-hidden" style={{ flex: '0 0 58%' }}>
          {listing.image ? (
            <img
              src={listing.image}
              alt={listing.title}
              className="w-full h-full object-cover select-none"
              draggable={false}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Home size={40} className="text-muted/40" strokeWidth={1} />
            </div>
          )}

          {/* Gradient overlay so badge text is always legible */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.30) 0%, transparent 50%)' }}
          />

          {/* Source + time badge — bottom-left of image */}
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <span
              className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide backdrop-blur-sm ${
                SOURCE_COLORS[listing.source] ?? 'bg-black/60 text-white'
              }`}
            >
              {listing.source}
            </span>
            <span className="text-[11px] font-medium text-white/90 drop-shadow">
              {listing.postedAt}
            </span>
          </div>

          {/* New badge */}
          {listing.isNew && (
            <div className="absolute top-3 left-3">
              <span className="bg-green-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide shadow">
                New
              </span>
            </div>
          )}

          {/* ── SAVE indicator overlay ── */}
          {isTop && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ opacity: saveOpacity, background: 'rgba(34,197,94,0.12)' }}
            >
              <div className="bg-green-500 text-white px-5 py-2.5 rounded-2xl flex items-center gap-2 -rotate-12 shadow-xl">
                <Bookmark size={17} strokeWidth={2.5} />
                <span className="text-sm font-bold tracking-widest uppercase">Saved</span>
              </div>
            </motion.div>
          )}

          {/* ── SKIP indicator overlay ── */}
          {isTop && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ opacity: skipOpacity, background: 'rgba(0,0,0,0.06)' }}
            >
              <div className="bg-foreground text-background px-5 py-2.5 rounded-2xl flex items-center gap-2 rotate-12 shadow-xl">
                <SkipForward size={17} strokeWidth={2.5} />
                <span className="text-sm font-bold tracking-widest uppercase">Skip</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* ── Details section (bottom ~42%) ── */}
        <div className="flex flex-col justify-center px-5 py-4 flex-1 gap-1.5">
          {/* Neighbourhood */}
          <p className="text-[15px] font-semibold text-foreground leading-snug line-clamp-1">
            {listing.neighborhood || listing.city}
          </p>

          {/* Price — most prominent */}
          <p className="text-[26px] font-black text-foreground leading-none tracking-tight">
            €{listing.price.toLocaleString()}
            <span className="text-sm font-normal text-muted ml-1">/mo</span>
          </p>

          {/* Metadata row */}
          <div className="flex items-center gap-2 text-muted text-xs mt-0.5 flex-wrap">
            <span className="flex items-center gap-1">
              <Home size={11} strokeWidth={1.8} />
              {listing.type}
            </span>
            {listing.size > 0 && (
              <>
                <span className="w-1 h-1 rounded-full bg-border flex-shrink-0" />
                <span className="flex items-center gap-1">
                  <Ruler size={11} strokeWidth={1.8} />
                  {listing.size}m²
                </span>
              </>
            )}
            <span className="w-1 h-1 rounded-full bg-border flex-shrink-0" />
            <span className="capitalize">{listing.furnished}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/* ─── Catch Up View ──────────────────────────────────────────────────────────*/

interface Props {
  open: boolean
  onClose: () => void
  onOpenListing: (listing: Listing) => void
}

export default function CatchUpView({ open, onClose, onOpenListing }: Props) {
  const { listings } = useListings()
  const { toggleSave, isSaved } = useSaved()

  const newListings = useMemo(
    () => listings.filter((l) => l.isNew).slice(0, 30),
    [listings],
  )

  const [currentIndex, setCurrentIndex] = useState(0)
  const [history, setHistory] = useState<
    { index: number; action: 'save' | 'skip'; listingId: string }[]
  >([])
  const isAnimating = useRef(false)
  const topX = useMotionValue(0)

  // Measure container width → radius for arc calculation
  const containerRef = useRef<HTMLDivElement>(null)
  const [radius, setRadius] = useState(200)

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        // radius = half container width gives a natural, tight arc fan
        setRadius(containerRef.current.offsetWidth * 0.52)
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Reset on open
  useEffect(() => {
    if (open) {
      setCurrentIndex(0)
      setHistory([])
      topX.set(0)
      isAnimating.current = false
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const isDone    = currentIndex >= newListings.length
  const remaining = Math.max(newListings.length - currentIndex, 0)
  const visibleCards = newListings.slice(currentIndex, currentIndex + 4)

  const commitSwipe = useCallback(
    (direction: 'left' | 'right') => {
      if (isAnimating.current || isDone) return
      isAnimating.current = true

      const listing = newListings[currentIndex]
      if (!listing) { isAnimating.current = false; return }

      if (direction === 'right' && !isSaved(listing.id)) toggleSave(listing.id)

      const dir = direction === 'right' ? 1 : -1
      animate(topX, dir * 500, {
        duration: 0.25,
        ease: 'easeOut',
        onComplete: () => {
          setHistory((prev) => [
            ...prev,
            { index: currentIndex, action: direction === 'right' ? 'save' : 'skip', listingId: listing.id },
          ])
          setCurrentIndex((prev) => prev + 1)
          topX.set(0)
          isAnimating.current = false
        },
      })
    },
    [currentIndex, isDone, newListings, isSaved, toggleSave, topX],
  )

  const handlePanEnd = useCallback(
    (_: PointerEvent, info: { offset: { x: number }; velocity: { x: number } }) => {
      if (isAnimating.current) return
      const shouldSwipe =
        Math.abs(info.offset.x) > SWIPE_THRESHOLD ||
        Math.abs(info.velocity.x) > VELOCITY_THRESHOLD
      if (shouldSwipe) {
        commitSwipe(info.offset.x > 0 ? 'right' : 'left')
      } else {
        animate(topX, 0, { type: 'spring', stiffness: 500, damping: 35 })
      }
    },
    [commitSwipe, topX],
  )

  const handleUndo = useCallback(() => {
    if (history.length === 0 || isAnimating.current) return
    isAnimating.current = true
    const last = history[history.length - 1]
    if (last.action === 'save' && isSaved(last.listingId)) toggleSave(last.listingId)
    setCurrentIndex(last.index)
    setHistory((prev) => prev.slice(0, -1))
    const dir = last.action === 'save' ? 1 : -1
    topX.set(dir * 500)
    animate(topX, 0, {
      type: 'spring',
      stiffness: 300,
      damping: 30,
      onComplete: () => { isAnimating.current = false },
    })
  }, [history, isSaved, toggleSave, topX])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 bg-background z-50 flex flex-col"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-5 pt-14 pb-3 flex-shrink-0">
            <button
              onClick={onClose}
              className="w-9 h-9 bg-secondary rounded-full flex items-center justify-center active:opacity-60 text-foreground"
            >
              <X size={16} strokeWidth={2} />
            </button>

            {!isDone && newListings.length > 0 && (
              <div className="flex items-center gap-1 overflow-hidden">
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={remaining}
                    className="text-[15px] font-bold text-foreground tabular-nums"
                    initial={{ opacity: 0, y: -8, scale: 0.7 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.7 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  >
                    {remaining}
                  </motion.span>
                </AnimatePresence>
                <span className="text-[15px] font-bold text-foreground">left</span>
              </div>
            )}

            <button
              onClick={handleUndo}
              disabled={history.length === 0}
              className="w-9 h-9 bg-secondary rounded-full flex items-center justify-center active:opacity-60 disabled:opacity-30 transition-opacity text-foreground"
            >
              <Undo2 size={15} strokeWidth={2} />
            </button>
          </div>

          {/* ── Arc card stack ── */}
          <div ref={containerRef} className="flex-1 relative overflow-hidden">
            {newListings.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8">
                <div className="w-16 h-16 bg-secondary rounded-3xl flex items-center justify-center">
                  <Sparkles size={28} strokeWidth={1.5} className="text-muted" />
                </div>
                <h2 className="text-lg font-bold text-foreground">No new listings</h2>
                <p className="text-sm text-muted text-center">
                  Pull down to refresh on the main feed to check for new listings.
                </p>
                <button
                  onClick={onClose}
                  className="mt-2 h-12 px-8 bg-foreground text-background rounded-full text-[15px] font-semibold"
                >
                  Go back
                </button>
              </div>
            ) : isDone ? (
              <motion.div
                className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', damping: 20, stiffness: 200, delay: 0.15 }}
              >
                <span className="text-6xl mb-2">🏠</span>
                <h2 className="text-2xl font-bold text-foreground">All caught up!</h2>
                <p className="text-sm text-muted text-center leading-relaxed">
                  You've reviewed all new listings.
                  <br />
                  Check back later for more.
                </p>
                <button
                  onClick={onClose}
                  className="mt-4 h-12 px-8 bg-foreground text-background rounded-full text-[15px] font-semibold"
                >
                  Done
                </button>
              </motion.div>
            ) : (
              // Render back→front so the top card is always painted last (on top)
              [...visibleCards].reverse().map((listing, reversedI) => {
                const stackIndex = visibleCards.length - 1 - reversedI
                return (
                  <CatchUpCard
                    key={listing.id}
                    listing={listing}
                    isTop={stackIndex === 0}
                    stackIndex={stackIndex}
                    topX={topX}
                    radius={radius}
                    onPanEnd={handlePanEnd}
                    onTap={() => onOpenListing(listing)}
                  />
                )
              })
            )}
          </div>

          {/* ── Footer ── */}
          {!isDone && newListings.length > 0 && (
            <div className="flex gap-3 px-5 pb-10 pt-3 flex-shrink-0">
              <button
                onClick={() => commitSwipe('left')}
                className="flex-1 h-14 bg-secondary rounded-2xl flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
              >
                <SkipForward size={16} strokeWidth={2} className="text-foreground" />
                <span className="text-[15px] font-semibold text-foreground">Skip</span>
              </button>
              <button
                onClick={() => commitSwipe('right')}
                className="flex-1 h-14 bg-foreground rounded-2xl flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
              >
                <Bookmark size={16} strokeWidth={2} className="text-background" />
                <span className="text-[15px] font-semibold text-background">Save</span>
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
