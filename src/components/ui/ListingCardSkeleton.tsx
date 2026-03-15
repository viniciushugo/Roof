export default function ListingCardSkeleton() {
  return (
    <div className="bg-white rounded-3xl border border-border overflow-hidden shadow-xs">
      {/* Image placeholder */}
      <div className="relative aspect-[16/9] bg-neutral-200 animate-pulse" />

      {/* Info */}
      <div className="px-4 pt-4 pb-5">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex-1">
            {/* Neighborhood */}
            <div className="h-[17px] w-32 bg-neutral-200 animate-pulse rounded-md" />
            {/* Price */}
            <div className="h-7 w-40 bg-neutral-200 animate-pulse rounded-md mt-1.5" />
          </div>
          {/* Source badge */}
          <div className="h-6 w-20 bg-neutral-200 animate-pulse rounded-full flex-shrink-0" />
        </div>

        {/* Meta row: type · size · furnished · time */}
        <div className="flex items-center gap-3 mt-2">
          <div className="h-4 w-16 bg-neutral-200 animate-pulse rounded-md" />
          <span className="w-1 h-1 rounded-full bg-neutral-200" />
          <div className="h-4 w-14 bg-neutral-200 animate-pulse rounded-md" />
          <span className="w-1 h-1 rounded-full bg-neutral-200" />
          <div className="h-4 w-20 bg-neutral-200 animate-pulse rounded-md" />
          <span className="w-1 h-1 rounded-full bg-neutral-200" />
          <div className="h-4 w-12 bg-neutral-200 animate-pulse rounded-md" />
        </div>

        {/* Description lines */}
        <div className="mt-2 space-y-1.5">
          <div className="h-4 w-full bg-neutral-200 animate-pulse rounded-md" />
          <div className="h-4 w-3/4 bg-neutral-200 animate-pulse rounded-md" />
        </div>
      </div>
    </div>
  )
}
