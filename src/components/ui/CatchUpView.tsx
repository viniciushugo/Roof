import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
  motion,
  MotionValue,
  useMotionValue,
  useTransform,
  animate,
  AnimatePresence,
} from 'framer-motion'
import { X, Undo2, Heart, SkipForward, Sparkles } from 'lucide-react'
import { Listing } from '../../data/listings'
import { useListings } from '../../context/ListingsContext'
import { useSaved } from '../../context/SavedContext'
import ListingCard from './ListingCard'

// ─── Swipe constants ─────────────────────────────────────────────────────────
const SWIPE_THRESHOLD    = 80
const VELOCITY_THRESHOLD = 400

// ─── Spring presets ───────────────────────────────────────────────────────────
const SPRING_EXIT   = { type: 'spring' as const, stiffness: 160, damping: 20, mass: 0.75 }
const SPRING_RETURN = { type: 'spring' as const, stiffness: 320, damping: 26, mass: 0.9 }
const SPRING_ENTER  = { type: 'spring' as const, stiffness: 300, damping: 28, mass: 0.9 }
const SPRING_UNDO   = { type: 'spring' as const, stiffness: 260, damping: 26, mass: 0.9 }

/* ─── Card component ─────────────────────────────────────────────────────────
   Two visual states:
   • isTop=true  — full size, draggable, with Like/Skip overlays
   • isTop=false — peeking card behind: smaller, slightly below, no interaction
*/
interface CardProps {
  listing: Listing
  isTop: boolean
  driveX: MotionValue<number>
  isSaved: boolean
  onToggleSave: () => void
  onPanEnd?: (e: PointerEvent, info: { offset: { x: number }; velocity: { x: number } }) => void
  onTap: () => void
  withGestures?: boolean
  overrideZIndex?: number
}

function CatchUpCard({
  listing,
  isTop,
  driveX,
  isSaved,
  onToggleSave,
  onPanEnd,
  onTap,
  withGestures = true,
  overrideZIndex,
}: CardProps) {
  const hasDragged = useRef(false)

  const dragRotate  = useTransform(driveX, [-200, 200], [-8, 8])
  const likeOpacity = useTransform(driveX, [0, SWIPE_THRESHOLD], [0, 1])
  const skipOpacity = useTransform(driveX, [-SWIPE_THRESHOLD, 0], [1, 0])

  return (
    <motion.div
      className="absolute inset-x-4"
      style={
        isTop
          ? {
              x: driveX,
              rotate: dragRotate,
              top: 0,
              bottom: 0,
              zIndex: overrideZIndex ?? 10,
              touchAction: withGestures ? 'none' : 'auto',
              pointerEvents: withGestures ? 'auto' : 'none',
              willChange: 'transform',
            }
          : {
              // Peek card: visible bottom edge, scaled down slightly
              bottom: -12,
              height: '96%',
              zIndex: overrideZIndex ?? 5,
              willChange: 'transform',
            }
      }
      initial={false}
      animate={
        !withGestures
          ? { scale: 1, opacity: 1 }
          : isTop
            ? { scale: 1, y: 0, opacity: 1 }
            : { scale: 0.95, y: 0, opacity: 1 }
      }
      transition={isTop ? SPRING_ENTER : { type: 'spring', stiffness: 280, damping: 26 }}
      onPanStart={isTop && withGestures ? () => { hasDragged.current = false } : undefined}
      onPan={
        isTop && withGestures
          ? (_, info) => {
              driveX.set(info.offset.x)
              if (Math.abs(info.offset.x) > 3) hasDragged.current = true
            }
          : undefined
      }
      onPanEnd={isTop && withGestures ? onPanEnd : undefined}
    >
      {/* Card shell */}
      <div className="relative rounded-3xl overflow-hidden shadow-2xl h-full">
        <ListingCard
          listing={listing}
          index={0}
          onClick={() => { if (!hasDragged.current && withGestures) onTap() }}
          isSaved={isSaved}
          onToggleSave={onToggleSave}
        />

        {/* ── LIKE overlay ── */}
        {isTop && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-3xl"
            style={{ opacity: likeOpacity, background: 'rgba(34,197,94,0.10)' }}
          >
            <div className="bg-green-500 text-white px-5 py-2.5 rounded-2xl flex items-center gap-2 -rotate-12 shadow-xl">
              <Heart size={17} strokeWidth={2.5} fill="white" />
              <span className="text-sm font-bold tracking-widest uppercase">Liked</span>
            </div>
          </motion.div>
        )}

        {/* ── SKIP overlay ── */}
        {isTop && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-3xl"
            style={{ opacity: skipOpacity, background: 'rgba(0,0,0,0.05)' }}
          >
            <div className="bg-foreground text-background px-5 py-2.5 rounded-2xl flex items-center gap-2 rotate-12 shadow-xl">
              <SkipForward size={17} strokeWidth={2.5} />
              <span className="text-sm font-bold tracking-widest uppercase">Skip</span>
            </div>
          </motion.div>
        )}
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
  const exitX = useMotionValue(0)
  const [exitingListing, setExitingListing] = useState<Listing | null>(null)

  useEffect(() => {
    if (open) {
      setCurrentIndex(0)
      setHistory([])
      setExitingListing(null)
      topX.set(0)
      exitX.set(0)
      isAnimating.current = false
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const isDone    = currentIndex >= newListings.length
  const remaining = Math.max(newListings.length - currentIndex, 0)
  const topCard   = newListings[currentIndex]
  const nextCard  = newListings[currentIndex + 1]

  const commitSwipe = useCallback(
    (direction: 'left' | 'right', throwVelocity = 0) => {
      if (isAnimating.current || isDone) return
      isAnimating.current = true

      const listing = newListings[currentIndex]
      if (!listing) { isAnimating.current = false; return }

      if (direction === 'right' && !isSaved(listing.id)) toggleSave(listing.id)

      const dir = direction === 'right' ? 1 : -1

      exitX.set(topX.get())
      setExitingListing(listing)
      topX.set(0)

      setHistory((prev) => [
        ...prev,
        { index: currentIndex, action: direction === 'right' ? 'save' : 'skip', listingId: listing.id },
      ])
      setCurrentIndex((prev) => prev + 1)
      isAnimating.current = false

      animate(exitX, dir * 650, {
        ...SPRING_EXIT,
        velocity: throwVelocity * dir,
        onComplete: () => {
          setExitingListing(null)
          exitX.set(0)
        },
      })
    },
    [currentIndex, isDone, newListings, isSaved, toggleSave, topX, exitX],
  )

  const handlePanEnd = useCallback(
    (_: PointerEvent, info: { offset: { x: number }; velocity: { x: number } }) => {
      if (isAnimating.current) return
      const shouldSwipe =
        Math.abs(info.offset.x) > SWIPE_THRESHOLD ||
        Math.abs(info.velocity.x) > VELOCITY_THRESHOLD
      if (shouldSwipe) {
        commitSwipe(info.offset.x > 0 ? 'right' : 'left', info.velocity.x)
      } else {
        animate(topX, 0, SPRING_RETURN)
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
    topX.set(dir * 600)
    animate(topX, 0, {
      ...SPRING_UNDO,
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
          <div className="flex items-center justify-between px-5 pt-header pb-3 flex-shrink-0">
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
                <span className="text-[15px] font-bold text-foreground"> new</span>
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

          {/* ── Card area ── */}
          <div className="flex-1 relative pb-4 px-0">
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
              <>
                {/* Peek card — next listing, sits behind */}
                {nextCard && (
                  <CatchUpCard
                    key={`peek-${nextCard.id}`}
                    listing={nextCard}
                    isTop={false}
                    driveX={useMotionValue(0)}
                    isSaved={isSaved(nextCard.id)}
                    onToggleSave={() => {}}
                    onTap={() => {}}
                    withGestures={false}
                  />
                )}

                {/* Active top card */}
                <AnimatePresence>
                  {topCard && !exitingListing && (
                    <CatchUpCard
                      key={topCard.id}
                      listing={topCard}
                      isTop={true}
                      driveX={topX}
                      isSaved={isSaved(topCard.id)}
                      onToggleSave={() => toggleSave(topCard.id)}
                      onPanEnd={handlePanEnd}
                      onTap={() => onOpenListing(topCard)}
                    />
                  )}
                </AnimatePresence>

                {/* Exit overlay — flies off independently */}
                {exitingListing && (
                  <CatchUpCard
                    key="__exit__"
                    listing={exitingListing}
                    isTop={true}
                    driveX={exitX}
                    isSaved={isSaved(exitingListing.id)}
                    onToggleSave={() => {}}
                    onTap={() => {}}
                    withGestures={false}
                    overrideZIndex={20}
                  />
                )}
              </>
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
                <Heart size={16} strokeWidth={2} fill="currentColor" className="text-background" />
                <span className="text-[15px] font-semibold text-background">Like</span>
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
