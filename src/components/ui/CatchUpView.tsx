import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
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

// ─── Swipe constants ─────────────────────────────────────────────────────────
const SWIPE_THRESHOLD    = 80
const VELOCITY_THRESHOLD = 400

// ─── Spring presets ───────────────────────────────────────────────────────────
const SPRING_EXIT   = { type: 'spring' as const, stiffness: 160, damping: 20, mass: 0.75 }
const SPRING_RETURN = { type: 'spring' as const, stiffness: 320, damping: 26, mass: 0.9 }
const SPRING_UNDO   = { type: 'spring' as const, stiffness: 260, damping: 26, mass: 0.9 }

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
    <div className="rounded-3xl overflow-hidden shadow-lg">
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
  const hasDragged  = useRef(false)

  // All motion values at top level — never inside conditions (Rules of Hooks)
  const topX        = useMotionValue(0)
  const exitX       = useMotionValue(0)
  const dragRotate  = useTransform(topX, [-220, 220], [-8, 8])
  const likeOpacity = useTransform(topX, [0, SWIPE_THRESHOLD], [0, 1])
  const skipOpacity = useTransform(topX, [-SWIPE_THRESHOLD, 0], [1, 0])

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
  // Spacer uses the first listing so the container is always the right height
  const spacerCard = newListings[0]

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

      animate(exitX, dir * 700, {
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
            <h1 className="text-2xl font-bold text-foreground">Catch Up</h1>

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

                {/*
                  ── Peek card ─────────────────────────────────────────────────
                  Stable key "peek" so it never remounts between swipes.
                  Shown for every card except the last (remaining > 1).
                  AnimatePresence fades it out gracefully on the last card.
                */}
                <AnimatePresence>
                  {remaining > 1 && nextCard && (
                    <motion.div
                      key="peek"
                      className="absolute inset-x-3 inset-y-0 z-0 pointer-events-none origin-top"
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 0.85, scale: 0.95, y: 10 }}
                      exit={{ opacity: 0, scale: 0.92, y: 14 }}
                      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
                    >
                      <CardShell
                        listing={nextCard}
                        isSaved={isSaved(nextCard.id)}
                        onToggleSave={() => {}}
                        onClick={() => {}}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/*
                  ── Top card ──────────────────────────────────────────────────
                  Absolute, sits over the spacer. Starts from peek position
                  (scale 0.95, y 10) and springs to full size — so new cards
                  appear to "promote" up from behind, not flash in from nowhere.
                */}
                <AnimatePresence>
                  {topCard && !exitingListing && (
                    <motion.div
                      key={topCard.id}
                      className="absolute inset-0 z-10"
                      style={{
                        x: topX,
                        rotate: dragRotate,
                        touchAction: 'none',
                        cursor: 'grab',
                      }}
                      initial={{ scale: 0.95, y: 10, opacity: 0.85 }}
                      animate={{ scale: 1, y: 0, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 28, mass: 0.8 }}
                      onPanStart={() => { hasDragged.current = false }}
                      onPan={(_, info) => {
                        topX.set(info.offset.x)
                        if (Math.abs(info.offset.x) > 4) hasDragged.current = true
                      }}
                      onPanEnd={handlePanEnd}
                      onClick={() => { if (!hasDragged.current) onOpenListing(topCard) }}
                    >
                      <div className="relative rounded-3xl overflow-hidden shadow-xl h-full">
                        <ListingCard
                          listing={topCard}
                          index={0}
                          onClick={() => {}}
                          isSaved={isSaved(topCard.id)}
                          onToggleSave={() => { hapticLight(); toggleSave(topCard.id) }}
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
                  )}
                </AnimatePresence>

                {/*
                  ── Exit card ─────────────────────────────────────────────────
                  Absolute overlay that flies off while the new top card
                  promotes up from below. No enter animation — it starts
                  exactly where the top card was (exitX = topX snapshot).
                */}
                {exitingListing && (
                  <motion.div
                    className="absolute inset-0 z-20 pointer-events-none"
                    style={{ x: exitX, rotate: dragRotate }}
                  >
                    <div className="rounded-3xl overflow-hidden shadow-xl h-full">
                      <ListingCard
                        listing={exitingListing}
                        index={0}
                        onClick={() => {}}
                        isSaved={isSaved(exitingListing.id)}
                        onToggleSave={() => {}}
                      />
                    </div>
                  </motion.div>
                )}

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
                onClick={() => { hapticLight(); commitSwipe('left') }}
                className="flex-1 h-14 bg-secondary text-foreground rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                <SkipForward size={16} strokeWidth={2} />
                Skip
              </button>

              <button
                onClick={() => { hapticLight(); commitSwipe('right') }}
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
