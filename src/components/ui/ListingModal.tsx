import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ExternalLink, Copy, Check, Home, Ruler, Sparkles, Calendar, Share2, ArrowLeft } from 'lucide-react'
import { hapticLight } from '../../lib/haptics'
import { track } from '../../lib/analytics'
import { shareListing } from '../../lib/share'
import { Listing } from '../../data/listings'
import SourceBadge from './SourceBadge'
import ImageGallery from './ImageGallery'

function generateIntro(listing: Listing): string {
  const typeLabel =
    listing.type === 'Private room' ? 'room'
    : listing.type === 'Shared room' ? 'shared room'
    : listing.type === 'Studio' ? 'studio'
    : 'apartment'

  const furnishedNote =
    listing.furnished === 'furnished'
      ? ` The furnished setup is exactly what I'm looking for.`
      : listing.furnished === 'upholstered'
      ? ` I see it's upholstered, which works well for me.`
      : ''

  return `Hi,\n\nI came across your ${typeLabel} in ${listing.neighborhood} (€${listing.price.toLocaleString()}/mo, ${listing.size}m²) and I'm very interested.${furnishedNote}\n\nI'd love to schedule a viewing at your earliest convenience — could you let me know your availability?\n\nBest regards,`
}

function formatDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return null }
}

interface Props {
  listing: Listing | null
  onClose: () => void
  onViewed?: (id: string) => void
}

export default function ListingModal({ listing, onClose, onViewed }: Props) {
  const [copied, setCopied] = useState(false)
  const [introText, setIntroText] = useState('')
  const [editingIntro, setEditingIntro] = useState(false)
  const [draftText, setDraftText] = useState('')

  useEffect(() => {
    if (listing) {
      const intro = generateIntro(listing)
      setIntroText(intro)
      onViewed?.(listing.id)
      track('property_details_viewed', {
        property_id: listing.id,
        source: listing.source,
        city: listing.city,
        price: listing.price,
      })
    }
  }, [listing?.id, onViewed])

  const openEditor = () => {
    setDraftText(introText)
    setEditingIntro(true)
  }

  const saveEditor = () => {
    setIntroText(draftText)
    setEditingIntro(false)
  }

  const copyIntro = async () => {
    try {
      await navigator.clipboard.writeText(introText)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = introText
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <AnimatePresence>
      {listing && (
        <>
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50 z-[2000]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 bg-background rounded-t-[28px] overflow-hidden z-[2001] flex flex-col"
            style={{ height: '92%' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 300 }}
          >
            {/* Floating Top Controls (Pull Tab & Close Button) */}
            <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
              <div className="h-24 bg-gradient-to-b from-black/50 to-transparent" />
              <div className="absolute top-3 inset-x-0 flex justify-center">
                <div className="w-10 h-1.5 rounded-full bg-white/70" />
              </div>
              <button
                onClick={onClose}
                className="absolute top-3 right-4 w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center active:scale-95 transition-transform pointer-events-auto"
              >
                <X size={15} strokeWidth={2.5} className="text-white" />
              </button>
            </div>

            {/* Scrollable details */}
            <div className="flex-1 overflow-y-auto scrollbar-hide overscroll-contain flex flex-col relative">
              {/* Hero image — scrolls with content */}
              <div className="relative w-full aspect-[4/3] max-h-[350px] flex-shrink-0 bg-secondary">
                <ImageGallery images={listing.images ?? []} alt={listing.title} fill />
                
                {/* Source badges inside image */}
                <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between pointer-events-none">
                  <div className="pointer-events-auto">
                    {listing.isNew ? (
                      <span className="bg-green-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">New</span>
                    ) : <span />}
                  </div>
                  <div className="pointer-events-auto">
                    <SourceBadge source={listing.source} />
                  </div>
                </div>
              </div>

              <div className="px-5 pt-6 pb-4">
                <div className="mb-4">
                  <p className="text-[22px] font-bold text-foreground leading-tight">{listing.neighborhood}</p>
                  <p className="text-sm text-muted mt-0.5">{listing.city}</p>
                  <p className="text-3xl font-bold text-foreground mt-2">
                    €{listing.price.toLocaleString()}
                    <span className="text-base font-normal text-muted">/mo</span>
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 mb-5">
                  <span className="flex items-center gap-1.5 px-3 h-8 bg-secondary rounded-full text-[13px] font-medium text-foreground">
                    <Home size={13} strokeWidth={1.8} />{listing.type}
                  </span>
                  {listing.size > 0 && (
                    <span className="flex items-center gap-1.5 px-3 h-8 bg-secondary rounded-full text-[13px] font-medium text-foreground">
                      <Ruler size={13} strokeWidth={1.8} />{listing.size}m²
                    </span>
                  )}
                  <span className="px-3 h-8 bg-secondary rounded-full text-[13px] font-medium text-foreground flex items-center capitalize">
                    {listing.furnished}
                  </span>
                  {formatDate(listing.availableFrom) && (
                    <span className="flex items-center gap-1.5 px-3 h-8 bg-secondary rounded-full text-[13px] font-medium text-foreground">
                      <Calendar size={13} strokeWidth={1.8} />From {formatDate(listing.availableFrom)}
                    </span>
                  )}
                </div>

                {listing.description && (
                  <p className="text-[15px] text-foreground leading-relaxed mb-5">{listing.description}</p>
                )}
              </div>

              {/* Intro message (part of scrollable content) */}
              <div className="mt-auto flex-shrink-0 border-t border-border/40 py-5 px-5">
                <button onClick={openEditor} className="w-full text-left active:opacity-75 transition-opacity">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 bg-foreground rounded-md flex items-center justify-center flex-shrink-0">
                      <Sparkles size={11} className="text-background" />
                    </div>
                    <p className="text-[13px] font-semibold text-foreground">Intro message</p>
                    <p className="text-[11px] text-muted ml-auto">Tap to edit →</p>
                  </div>
                  <p className="text-[14px] text-foreground leading-relaxed bg-secondary rounded-xl px-4 py-3">
                    {introText}
                  </p>
                </button>
              </div>
            </div>

            {/* Pinned actions */}
            <div className="flex-shrink-0 border-t border-border bg-background px-4 pt-3 pb-8">
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    hapticLight()
                    track('listing_shared', { listing_id: listing.id, source: listing.source })
                    try {
                      await shareListing({
                        title: listing.title,
                        text: `€${listing.price}/mo in ${listing.neighborhood || listing.city}`,
                        url: listing.url,
                      })
                    } catch {}
                  }}
                  className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center active:scale-[0.98] transition-all flex-shrink-0"
                  aria-label="Share"
                >
                  <Share2 size={16} strokeWidth={2} className="text-foreground" />
                </button>
                <button
                  onClick={copyIntro}
                  className={`flex-1 h-12 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all min-w-0 ${copied ? 'bg-green-500 text-white' : 'bg-secondary text-foreground'}`}
                >
                  {copied ? <><Check size={14} strokeWidth={2.5} /><span className="truncate">Copied!</span></> : <><Copy size={14} /><span className="truncate">Copy intro</span></>}
                </button>
                <a
                  href={listing.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-[1.2] h-12 bg-foreground text-background rounded-xl text-[14px] font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all min-w-0"
                >
                  <span className="truncate">Go to listing</span> <ExternalLink size={14} className="flex-shrink-0" />
                </a>
              </div>
            </div>

            {/* Full-page intro editor — slides in from the right */}
            <AnimatePresence>
              {editingIntro && (
                <motion.div
                  className="absolute inset-0 bg-background rounded-t-[28px] z-10 flex flex-col"
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                >
                  <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border flex-shrink-0">
                    <button
                      onClick={() => setEditingIntro(false)}
                      className="w-9 h-9 bg-secondary rounded-full flex items-center justify-center active:opacity-60 text-foreground"
                    >
                      <ArrowLeft size={16} strokeWidth={2} />
                    </button>
                    <div className="flex-1">
                      <p className="text-[15px] font-semibold text-foreground">Edit intro message</p>
                      <p className="text-xs text-muted">Personalise before sending</p>
                    </div>
                    <button
                      onClick={saveEditor}
                      className="px-5 h-9 bg-foreground text-background rounded-full text-sm font-semibold active:opacity-80"
                    >
                      Save
                    </button>
                  </div>
                  <div className="flex-1 px-5 pt-4 pb-8">
                    <textarea
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      autoFocus
                      className="w-full h-full text-[15px] text-foreground leading-relaxed resize-none bg-secondary rounded-2xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-foreground/15"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
