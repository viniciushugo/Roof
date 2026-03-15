import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ExternalLink, Copy, Check, Home, Ruler, Sparkles, Calendar, Share2 } from 'lucide-react'
import { hapticLight } from '../../lib/haptics'
import { track } from '../../lib/analytics'
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
    return d.toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch {
    return null
  }
}

interface Props {
  listing: Listing | null
  onClose: () => void
  onViewed?: (id: string) => void
}

export default function ListingModal({ listing, onClose, onViewed }: Props) {
  const [copied, setCopied] = useState(false)
  const [introText, setIntroText] = useState('')

  useEffect(() => {
    if (listing) {
      setIntroText(generateIntro(listing))
      onViewed?.(listing.id)
      track('listing_viewed', {
        listing_id: listing.id,
        source: listing.source,
        city: listing.city,
        price: listing.price,
      })
    }
  }, [listing?.id, onViewed])

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
            className="absolute inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[28px] z-50 max-h-[92%] flex flex-col overflow-hidden"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 300 }}
          >
            {/* Hero image gallery */}
            <div className="relative flex-shrink-0 overflow-hidden rounded-t-[28px] bg-secondary">
              <ImageGallery images={listing.images} alt={listing.title} />
              <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 to-transparent pointer-events-none" />
              <div className="absolute top-3 inset-x-0 flex justify-center pointer-events-none">
                <div className="w-10 h-1 rounded-full bg-white/60" />
              </div>
              <button
                onClick={onClose}
                className="absolute top-3 right-4 w-8 h-8 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center active:opacity-70 transition-opacity"
              >
                <X size={14} strokeWidth={2.5} className="text-white" />
              </button>
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
                {listing.isNew ? (
                  <span className="bg-green-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">New</span>
                ) : <span />}
                <SourceBadge source={listing.source} />
              </div>
            </div>

            {/* Scrollable details */}
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              <div className="px-5 pt-5 pb-4">
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
            </div>

            {/* Pinned intro + actions */}
            <div className="flex-shrink-0 border-t border-border bg-white">
              {/* Editable intro */}
              <div className="px-5 pt-4 pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 bg-foreground rounded-md flex items-center justify-center flex-shrink-0">
                    <Sparkles size={11} className="text-white" />
                  </div>
                  <p className="text-[13px] font-semibold text-foreground">Intro message</p>
                  <p className="text-[11px] text-muted ml-auto">Tap to edit</p>
                </div>
                <textarea
                  value={introText}
                  onChange={(e) => setIntroText(e.target.value)}
                  rows={5}
                  className="w-full text-[15px] text-foreground leading-relaxed resize-none bg-secondary rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-foreground/15"
                />
              </div>

              {/* Action buttons */}
              <div className="px-5 pb-8 flex gap-3">
                {(typeof navigator !== 'undefined' && (navigator.share || navigator.clipboard)) && (
                  <button
                    onClick={async () => {
                      hapticLight()
                      track('listing_shared', { listing_id: listing.id, source: listing.source })
                      try {
                        await navigator.share({
                          title: listing.title,
                          text: `€${listing.price}/mo in ${listing.neighborhood || listing.city}`,
                          url: listing.url,
                        })
                      } catch {
                        try {
                          await navigator.clipboard.writeText(listing.url)
                        } catch {}
                      }
                    }}
                    className="w-14 h-14 bg-secondary rounded-2xl flex items-center justify-center active:scale-[0.98] transition-all flex-shrink-0"
                  >
                    <Share2 size={18} strokeWidth={1.8} className="text-foreground" />
                  </button>
                )}
                <button
                  onClick={copyIntro}
                  className={`flex-1 h-14 rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${
                    copied ? 'bg-green-500 text-white' : 'bg-secondary text-foreground'
                  }`}
                >
                  {copied ? <><Check size={16} strokeWidth={2.5} />Copied!</> : <><Copy size={15} />Copy intro</>}
                </button>

                <a
                  href={listing.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 h-14 bg-foreground text-white rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                >
                  Go to listing
                  <ExternalLink size={15} />
                </a>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
