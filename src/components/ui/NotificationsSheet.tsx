import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, BellOff } from 'lucide-react'
import { useListings } from '../../context/ListingsContext'
import { Listing } from '../../data/listings'

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

interface Props {
  open: boolean
  onClose: () => void
  onOpenListing: (listing: Listing) => void
}

export default function NotificationsSheet({ open, onClose, onOpenListing }: Props) {
  const { listings } = useListings()
  const newListings = listings.filter((l) => l.isNew).slice(0, 30)

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="absolute inset-0 bg-black/40 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[28px] z-50 max-h-[88%] flex flex-col"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 300 }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-neutral-200" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 border-b border-border">
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] font-bold text-foreground">Notifications</h2>
                {newListings.length > 0 && (
                  <span className="w-5 h-5 rounded-full bg-foreground text-white text-[10px] font-bold flex items-center justify-center">
                    {newListings.length > 9 ? '9+' : newListings.length}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center active:opacity-60"
              >
                <X size={15} strokeWidth={2} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {newListings.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
                  <div className="w-14 h-14 bg-secondary rounded-3xl flex items-center justify-center">
                    <BellOff size={22} strokeWidth={1.5} className="text-muted" />
                  </div>
                  <p className="text-[15px] font-semibold text-foreground">No new listings yet</p>
                  <p className="text-sm text-muted">Pull down to refresh and check for new matches.</p>
                </div>
              ) : (
                <div>
                  <div className="px-5 py-2.5">
                    <p className="text-xs font-semibold text-muted uppercase tracking-wide">New listings</p>
                  </div>
                  {newListings.map((listing) => (
                    <button
                      key={listing.id}
                      onClick={() => { onOpenListing(listing); onClose() }}
                      className="w-full flex items-center gap-3 px-5 py-3.5 active:bg-secondary transition-colors text-left"
                    >
                      {/* Thumbnail */}
                      <div className="w-12 h-12 rounded-xl bg-secondary flex-shrink-0 overflow-hidden">
                        {listing.image ? (
                          <img
                            src={listing.image}
                            alt={listing.title}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                        ) : (
                          <div className="w-full h-full bg-neutral-200" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${SOURCE_COLORS[listing.source] ?? 'bg-secondary text-muted'}`}
                          >
                            {listing.source}
                          </span>
                          <span className="text-xs text-muted">{listing.postedAt}</span>
                        </div>
                        <p className="text-sm font-semibold text-foreground truncate">{listing.neighborhood || listing.city}</p>
                        <p className="text-sm text-muted">
                          €{listing.price.toLocaleString()}/mo · {listing.size > 0 ? `${listing.size}m²` : listing.type}
                        </p>
                      </div>

                      {/* Green dot */}
                      <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
