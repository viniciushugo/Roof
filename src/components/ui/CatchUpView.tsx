import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
  motion,
  MotionValue,
  useMotionValue,
  useTransform,
  animate,
  AnimatePresence,
} from 'framer-motion'
import { X, Undo2, Bookmark, SkipForward, Home, Sparkles } from 'lucide-react'
import { Listing } from '../../data/listings'
import { useListings } from '../../context/ListingsContext'
import { useSaved } from '../../context/SavedContext'

const SOURCE_COLORS: Record<string, string> = {
  Pararius: 'bg-blue-50 text-blue-700',
  Kamernet: 'bg-red-50 text-red-700',
  Huurwoningen: 'bg-emerald-50 text-emerald-700',
  Funda: 'bg-orange-50 text-orange-700',
  HousingAnywhere: 'bg-purple-50 text-purple-700',
  DirectWonen: 'bg-cyan-50 text-cyan-700',
  Rentola: 'bg-fuchsia-50 text-fuchsia-700',
  'Kamer.nl': 'bg-amber-50 text-amber-700',
  Huurstunt: 'bg-teal-50 text-teal-700',
  '123Wonen': 'bg-indigo-50 text-indigo-700',
}

const SWIPE_THRESHOLD = 80
const VELOCITY_THRESHOLD = 400

/* ─── Swipeable Card ─── */

interface CardProps {
  listing: Listing
  isTop: boolean
  stackIndex: number
  topX: MotionValue<number>
  onPanEnd: (e: PointerEvent, info: { offset: { x: number }; velocity: { x: number } }) => void
  onTap: () => void
}

function CatchUpCard({ listing, isTop, stackIndex, topX, onPanEnd, onTap }: CardProps) {
  const hasDragged = useRef(false)

  const rotate = useTransform(topX, [-200, 200], [-12, 12])
  const saveOpacity = useTransform(topX, [0, SWIPE_THRESHOLD], [0, 1])
  const skipOpacity = useTransform(topX, [-SWIPE_THRESHOLD, 0], [1, 0])

  return (
    <motion.div
      className="absolute inset-0"
      style={
        isTop
          ? { x: topX, rotate, zIndex: 10, touchAction: 'none' }
          : { zIndex: 10 - stackIndex }
      }
      initial={false}
      animate={
        isTop
          ? { scale: 1, y: 0, opacity: 1 }
          : {
              scale: 1 - stackIndex * 0.04,
              y: stackIndex * 10,
              opacity: stackIndex < 3 ? 1 : 0,
            }
      }
      transition={
        isTop
          ? { duration: 0 }
          : { type: 'spring', stiffness: 300, damping: 30 }
      }
      onPanStart={
        isTop
          ? () => {
              hasDragged.current = false
            }
          : undefined
      }
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
      <div
        className="w-full h-full bg-white rounded-3xl shadow-lg border border-border overflow-hidden flex flex-col"
        style={{ willChange: 'transform' }}
        onClick={() => {
          if (isTop && !hasDragged.current) onTap()
        }}
      >
        {/* Image */}
        <div className="flex-1 relative bg-neutral-100 overflow-hidden min-h-0">
          {listing.image ? (
            <img
              src={listing.image}
              alt={listing.title}
              className="w-full h-full object-contain select-none"
              draggable={false}
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Home size={48} className="text-muted" strokeWidth={1} />
            </div>
          )}

          {/* Save indicator */}
          {isTop && (
            <motion.div
              className="absolute inset-0 bg-green-500/10 flex items-center justify-center pointer-events-none"
              style={{ opacity: saveOpacity }}
            >
              <div className="bg-green-500 text-white px-5 py-2.5 rounded-2xl flex items-center gap-2 -rotate-12 shadow-lg">
                <Bookmark size={18} strokeWidth={2.5} />
                <span className="text-base font-bold tracking-wide">SAVED</span>
              </div>
            </motion.div>
          )}

          {/* Skip indicator */}
          {isTop && (
            <motion.div
              className="absolute inset-0 bg-neutral-900/5 flex items-center justify-center pointer-events-none"
              style={{ opacity: skipOpacity }}
            >
              <div className="bg-foreground text-white px-5 py-2.5 rounded-2xl flex items-center gap-2 rotate-12 shadow-lg">
                <SkipForward size={18} strokeWidth={2.5} />
                <span className="text-base font-bold tracking-wide">SKIP</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Details */}
        <div className="p-5 flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                SOURCE_COLORS[listing.source] ?? 'bg-secondary text-muted'
              }`}
            >
              {listing.source}
            </span>
            <span className="text-xs text-muted">{listing.postedAt}</span>
          </div>
          <p className="text-lg font-bold text-foreground">
            {listing.neighborhood || listing.city}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[15px] text-foreground font-semibold">
              €{listing.price.toLocaleString()}/mo
            </span>
            <span className="text-muted">·</span>
            <span className="text-sm text-muted">{listing.type}</span>
            {listing.size > 0 && (
              <>
                <span className="text-muted">·</span>
                <span className="text-sm text-muted">{listing.size}m²</span>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/* ─── Catch Up View ─── */

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

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setCurrentIndex(0)
      setHistory([])
      topX.set(0)
      isAnimating.current = false
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const isDone = currentIndex >= newListings.length
  const remaining = Math.max(newListings.length - currentIndex, 0)
  const visibleCards = newListings.slice(currentIndex, currentIndex + 3)

  const commitSwipe = useCallback(
    (direction: 'left' | 'right') => {
      if (isAnimating.current || isDone) return
      isAnimating.current = true

      const listing = newListings[currentIndex]
      if (!listing) {
        isAnimating.current = false
        return
      }

      if (direction === 'right' && !isSaved(listing.id)) {
        toggleSave(listing.id)
      }

      const dir = direction === 'right' ? 1 : -1
      animate(topX, dir * 500, {
        duration: 0.25,
        ease: 'easeOut',
        onComplete: () => {
          setHistory((prev) => [
            ...prev,
            {
              index: currentIndex,
              action: direction === 'right' ? 'save' : 'skip',
              listingId: listing.id,
            },
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
        const direction = info.offset.x > 0 ? 'right' : 'left'
        commitSwipe(direction)
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

    // Undo save if it was saved
    if (last.action === 'save' && isSaved(last.listingId)) {
      toggleSave(last.listingId)
    }

    setCurrentIndex(last.index)
    setHistory((prev) => prev.slice(0, -1))

    // Animate card back in from the side it left
    const dir = last.action === 'save' ? 1 : -1
    topX.set(dir * 500)
    animate(topX, 0, {
      type: 'spring',
      stiffness: 300,
      damping: 30,
      onComplete: () => {
        isAnimating.current = false
      },
    })
  }, [history, isSaved, toggleSave, topX])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 bg-neutral-50 z-50 flex flex-col"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-14 pb-3 flex-shrink-0">
            <button
              onClick={onClose}
              className="w-9 h-9 bg-white rounded-full flex items-center justify-center active:opacity-60 shadow-sm"
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
              className="w-9 h-9 bg-white rounded-full flex items-center justify-center active:opacity-60 shadow-sm disabled:opacity-30 transition-opacity"
            >
              <Undo2 size={15} strokeWidth={2} />
            </button>
          </div>

          {/* Card stack */}
          <div className="flex-1 px-5 pb-3 relative overflow-hidden">
            {newListings.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8">
                <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center shadow-sm">
                  <Sparkles size={28} strokeWidth={1.5} className="text-muted" />
                </div>
                <h2 className="text-lg font-bold text-foreground">No new listings</h2>
                <p className="text-sm text-muted text-center">
                  Pull down to refresh on the main feed to check for new listings.
                </p>
                <button
                  onClick={onClose}
                  className="mt-2 h-12 px-8 bg-foreground text-white rounded-full text-[15px] font-semibold active:scale-[0.98] transition-transform"
                >
                  Go back
                </button>
              </div>
            ) : isDone ? (
              <motion.div
                className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  type: 'spring',
                  damping: 20,
                  stiffness: 200,
                  delay: 0.15,
                }}
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
                  className="mt-4 h-12 px-8 bg-foreground text-white rounded-full text-[15px] font-semibold active:scale-[0.98] transition-transform"
                >
                  Done
                </button>
              </motion.div>
            ) : (
              visibleCards.map((listing, i) => (
                <CatchUpCard
                  key={listing.id}
                  listing={listing}
                  isTop={i === 0}
                  stackIndex={i}
                  topX={topX}
                  onPanEnd={handlePanEnd}
                  onTap={() => onOpenListing(listing)}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {!isDone && newListings.length > 0 && (
            <div className="flex gap-4 px-5 pb-8 pt-2 flex-shrink-0">
              <button
                onClick={() => commitSwipe('left')}
                className="flex-1 h-14 bg-white rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-sm"
              >
                <SkipForward size={16} strokeWidth={2} className="text-foreground" />
                <span className="text-[15px] font-semibold text-foreground">Skip</span>
              </button>
              <button
                onClick={() => commitSwipe('right')}
                className="flex-1 h-14 bg-foreground rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <Bookmark size={16} strokeWidth={2} className="text-white" />
                <span className="text-[15px] font-semibold text-white">Save</span>
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
