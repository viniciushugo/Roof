import { useState, useRef, useEffect, useMemo, useCallback, forwardRef } from 'react'
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  AnimatePresence,
} from 'framer-motion'
import { X, Undo2, Heart, SkipForward, Sparkles, Share2 } from 'lucide-react'
import { hapticLight } from '../../lib/haptics'
import { Listing } from '../../data/listings'
import { useListings } from '../../context/ListingsContext'
import { useSaved } from '../../context/SavedContext'
import ListingCard from './ListingCard'
import { track } from '../../lib/analytics'

// ─── Swipe constants ─────────────────────────────────────────────────────────
const SWIPE_THRESHOLD    = 80
const VELOCITY_THRESHOLD = 400

// ─── Spring presets ───────────────────────────────────────────────────────────
const SPRING_RETURN = { type: 'spring' as const, stiffness: 320, damping: 26, mass: 0.9 }

// ─── Variants ────────────────────────────────────────────────────────────────
const cardVariants = {
  enter: {
    scale: 0.95,
    y: 10,
    opacity: 0.85,
  },
  center: {
    scale: 1,
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 300, damping: 28, mass: 0.8 }
  },
  exit: (custom: any) => {
    const dir = custom?.direction === 'right' ? 1 : -1
    return {
      x: dir * 700,
      opacity: 0,
      rotate: dir * 15,
      transition: {
        x: { type: 'spring', stiffness: 160, damping: 20, mass: 0.75, velocity: custom?.velocity || 0 },
        opacity: { duration: 0.25 }
      }
    }
  },
  undo: (custom: any) => {
    const dir = custom?.direction === 'right' ? 1 : -1
    return {
      x: dir * 600,
      opacity: 1,
      scale: 1,
      y: 0,
      rotate: dir * 15
    }
  }
}

/* ─── Card shell ─────────────────────────────────────────────────────────────
   Renders a ListingCard inside the rounded/shadow shell used by all card layers.
*/
function CardShell({ listing, isSaved, onToggleSave, onClick }: {
  listing: Listing
  isSaved: boolean
  onToggleSave: () => void
  onClick: () => void
}) {
  return (
    <div className="rounded-3xl overflow-hidden shadow-lg h-full">
      <ListingCard
        listing={listing}
        index={0}
        onClick={onClick}
        isSaved={isSaved}
        onToggleSave={onToggleSave}
      />
    </div>
  )
}

/* ─── SwipeableCard ──────────────────────────────────────────────────────────*/
const SwipeableCard = forwardRef<HTMLDivElement, any>(({
  listing,
  isTop,
  isSaved,
  onToggleSave,
  onOpenListing,
  onSwipe,
  ...rest
}, ref) => {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-220, 220], [-8, 8])
  const likeOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1])
  const skipOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0])
  const hasDragged = useRef(false)

  return (
    <motion.div
      ref={ref}
      className={`absolute inset-0 z-${isTop ? 10 : 0} ${isTop ? '' : 'pointer-events-none origin-top'}`}
      style={{ x, rotate, touchAction: isTop ? 'none' : 'auto', cursor: isTop ? 'grab' : 'auto' }}
      onPanStart={() => { if (isTop) hasDragged.current = false }}
      onPan={(_, info) => {
        if (!isTop) return
        x.set(info.offset.x)
        if (Math.abs(info.offset.x) > 4) hasDragged.current = true
      }}
      onPanEnd={(_, info) => {
        if (!isTop) return
        const shouldSwipe = Math.abs(info.offset.x) > SWIPE_THRESHOLD || Math.abs(info.velocity.x) > VELOCITY_THRESHOLD
        if (shouldSwipe) {
          onSwipe(info.offset.x > 0 ? 'right' : 'left', info.velocity.x)
        } else {
          animate(x, 0, SPRING_RETURN)
        }
      }}
      onClick={() => { if (!hasDragged.current && isTop) onOpenListing() }}
      {...rest}
    >
      <div className="relative rounded-3xl overflow-hidden shadow-xl h-full">
        <ListingCard
          listing={listing}
          index={0}
          onClick={() => {}}
          isSaved={isSaved}
          onToggleSave={() => { hapticLight(); onToggleSave() }}
        />

        {/* LIKE stamp */}
        <motion.div
          className="absolute inset-0 flex items-start justify-start p-5 pointer-events-none"
          style={{ opacity: likeOpacity, background: 'rgba(34,197,94,0.07)' }}
        >
          <div className="border-[3px] border-green-500 px-4 py-1.5 rounded-xl -rotate-[20deg] mt-1">
            <span className="text-green-500 text-lg font-black tracking-widest uppercase">Like</span>
          </div>
        </motion.div>

        {/* NOPE stamp */}
        <motion.div
          className="absolute inset-0 flex items-start justify-end p-5 pointer-events-none"
          style={{ opacity: skipOpacity, background: 'rgba(0,0,0,0.04)' }}
        >
          <div className="border-[3px] border-foreground/50 px-4 py-1.5 rounded-xl rotate-[20deg] mt-1">
            <span className="text-foreground/50 text-lg font-black tracking-widest uppercase">Nope</span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
})
SwipeableCard.displayName = 'SwipeableCard'

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
  
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null)
  const [exitVelocity, setExitVelocity] = useState<number>(0)
  const [isUndoAction, setIsUndoAction] = useState(false)
  const isAnimating = useRef(false)

  useEffect(() => {
    if (open) {
      setCurrentIndex(0)
      setHistory([])
      setExitDirection(null)
      setIsUndoAction(false)
      isAnimating.current = false
    }
  }, [open])

  const isDone    = currentIndex >= newListings.length
  const remaining = Math.max(newListings.length - currentIndex, 0)
  const topCard   = newListings[currentIndex]
  const spacerCard = newListings[0]

  const commitSwipe = useCallback(
    (direction: 'left' | 'right', throwVelocity = 0) => {
      if (isAnimating.current || isDone) return
      isAnimating.current = true

      const listing = newListings[currentIndex]
      if (!listing) { isAnimating.current = false; return }

      if (direction === 'right' && !isSaved(listing.id)) {
        track('property_liked', {
          property_id: listing.id,
          price: listing.price,
          housing_type: listing.type
        })
        toggleSave(listing.id)
      } else if (direction === 'left') {
        track('property_passed', {
          property_id: listing.id
        })
      }

      setExitDirection(direction)
      setExitVelocity(throwVelocity)
      setIsUndoAction(false)

      setHistory((prev) => [
        ...prev,
        { index: currentIndex, action: direction === 'right' ? 'save' : 'skip', listingId: listing.id },
      ])
      setCurrentIndex((prev) => prev + 1)
      
      setTimeout(() => { isAnimating.current = false }, 250)
    },
    [currentIndex, isDone, newListings, isSaved, toggleSave]
  )

  const handleUndo = useCallback(() => {
    if (history.length === 0 || isAnimating.current) return
    isAnimating.current = true
    
    const last = history[history.length - 1]
    if (last.action === 'save' && isSaved(last.listingId)) toggleSave(last.listingId)
    
    setIsUndoAction(true)
    setExitDirection(last.action === 'save' ? 'right' : 'left')
    setCurrentIndex(last.index)
    setHistory((prev) => prev.slice(0, -1))
    
    setTimeout(() => { isAnimating.current = false }, 250)
  }, [history, isSaved, toggleSave])

  const handleShare = useCallback(async () => {
    if (!topCard) return
    hapticLight()
    try {
      await navigator.share({
        title: topCard.title,
        text: `€${topCard.price.toLocaleString()}/mo in ${topCard.neighborhood}`,
        url: topCard.url,
      })
    } catch {
      try { await navigator.clipboard.writeText(topCard.url) } catch {}
    }
  }, [topCard])

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
          <div className="flex-shrink-0 px-5 pt-header pb-3 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Catch Up</h1>
              {!isDone && newListings.length > 0 && (
                <p className="text-[13px] text-muted mt-0.5">Your picks for today</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!isDone && newListings.length > 0 && (
                <div className="flex items-center gap-1 bg-secondary px-3 py-1 rounded-full">
                  <AnimatePresence mode="popLayout">
                    <motion.span
                      key={remaining}
                      className="text-[13px] font-bold text-foreground tabular-nums"
                      initial={{ opacity: 0, y: -6, scale: 0.7 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.7 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    >
                      {remaining}
                    </motion.span>
                  </AnimatePresence>
                  <span className="text-[13px] font-medium text-muted">new</span>
                </div>
              )}

              <button
                onClick={handleUndo}
                disabled={history.length === 0}
                className="w-9 h-9 bg-secondary rounded-full flex items-center justify-center active:opacity-60 disabled:opacity-30 transition-opacity text-foreground"
              >
                <Undo2 size={15} strokeWidth={2} />
              </button>

              <button
                onClick={onClose}
                className="w-9 h-9 bg-secondary rounded-full flex items-center justify-center active:opacity-60 text-foreground"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* ── Card area — flex-centered ── */}
          <div className="flex-1 flex flex-col justify-center overflow-hidden">

            {/* Empty state */}
            {newListings.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-4 px-8">
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
            )}

            {/* Done state */}
            {newListings.length > 0 && isDone && (
              <motion.div
                className="flex flex-col items-center justify-center gap-4 px-8"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', damping: 20, stiffness: 200, delay: 0.1 }}
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
            )}

            {/* Card stack */}
            {newListings.length > 0 && !isDone && spacerCard && (
              <div className="relative mx-4">

                {/*
                  ── Invisible spacer ──────────────────────────────────────────
                  Always in flow, holds the container height steady so that all
                  animated cards (which are absolute) never cause layout jumps.
                */}
                <div className="invisible pointer-events-none select-none" aria-hidden="true">
                  <CardShell
                    listing={spacerCard}
                    isSaved={false}
                    onToggleSave={() => {}}
                    onClick={() => {}}
                  />
                </div>

                {/* Array Mapped Stack for Preserved DOM nodes ────────────────*/}
                <AnimatePresence custom={{ direction: exitDirection, velocity: exitVelocity }}>
                  {newListings.slice(currentIndex, currentIndex + 2).reverse().map((listing, index, arr) => {
                    const isTop = index === arr.length - 1;
                    return (
                      <SwipeableCard
                        key={listing.id}
                        listing={listing}
                        isTop={isTop}
                        isSaved={isSaved(listing.id)}
                        onToggleSave={() => toggleSave(listing.id)}
                        onOpenListing={() => onOpenListing(listing)}
                        onSwipe={(dir: 'left' | 'right', vel: number) => commitSwipe(dir, vel)}
                        variants={cardVariants}
                        custom={{ direction: exitDirection, velocity: exitVelocity }}
                        initial={isUndoAction ? "undo" : "enter"}
                        animate={isTop ? "center" : "enter"}
                        exit="exit"
                      />
                    )
                  })}
                </AnimatePresence>

              </div>
            )}
          </div>

          {/* ── Footer — mirrors listing detail layout ── */}
          {!isDone && newListings.length > 0 && (
            <div className="flex-shrink-0 px-5 pb-8 pt-4 flex gap-3">
              <button
                onClick={handleShare}
                className="w-14 h-14 bg-secondary rounded-2xl flex items-center justify-center active:scale-[0.98] transition-all flex-shrink-0"
              >
                <Share2 size={18} strokeWidth={1.8} className="text-foreground" />
              </button>

              <button
                onClick={() => { hapticLight(); commitSwipe('left', 800) }}
                className="flex-1 h-14 bg-secondary text-foreground rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                <SkipForward size={16} strokeWidth={2} />
                Skip
              </button>

              <button
                onClick={() => { hapticLight(); commitSwipe('right', 800) }}
                className="flex-1 h-14 bg-foreground text-background rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                <Heart size={16} strokeWidth={2} fill="currentColor" />
                Like
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
