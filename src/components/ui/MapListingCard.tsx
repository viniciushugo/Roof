import { AnimatePresence, motion } from 'framer-motion'
import { Heart, ExternalLink, X } from 'lucide-react'
import { Listing, sourceColors } from '../../data/listings'
import SourceBadge from './SourceBadge'
import AddressPrecisionBadge from './AddressPrecisionBadge'
import { hapticLight } from '../../lib/haptics'

interface Props {
  listing: Listing | null
  onOpen: (listing: Listing) => void
  onClose: () => void
  isSaved: boolean
  onToggleSave: () => void
}

export default function MapListingCard({ listing, onOpen, onClose, isSaved, onToggleSave }: Props) {
  if (!listing) return null

  return (
    <AnimatePresence>
      <motion.div
        key={listing.id}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="absolute bottom-4 left-3 right-3 z-[1000]"
      >
        <div className="bg-background rounded-2xl border border-border shadow-lg overflow-hidden">
          <div className="flex gap-3 p-3">
            {/* Image */}
            <button
              onClick={() => onOpen(listing)}
              className="relative flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden bg-secondary"
            >
              {listing.image ? (
                <img
                  src={listing.image}
                  alt={listing.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted text-2xl">🏠</div>
              )}
            </button>

            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <SourceBadge source={listing.source} />
                  <AddressPrecisionBadge precision={listing.addressPrecision} />
                </div>
                <button
                  onClick={() => onOpen(listing)}
                  className="text-left"
                >
                  <p className="text-sm font-semibold text-foreground line-clamp-1">
                    {listing.addressRaw || listing.title}
                  </p>
                  <p className="text-xs text-muted mt-0.5 line-clamp-1">
                    {listing.city} · {listing.size > 0 ? `${listing.size}m²` : ''} {listing.rooms > 0 ? `· ${listing.rooms} room${listing.rooms > 1 ? 's' : ''}` : ''}
                  </p>
                </button>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-[15px] font-bold text-foreground">
                  €{listing.price.toLocaleString()}<span className="text-xs font-normal text-muted">/mo</span>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      hapticLight()
                      onToggleSave()
                    }}
                    className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <Heart
                      size={18}
                      strokeWidth={2}
                      className={isSaved ? 'fill-red-500 text-red-500' : 'text-muted'}
                    />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onClose()
                    }}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-secondary active:scale-90 transition-transform"
                  >
                    <X size={14} strokeWidth={2} className="text-muted" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
