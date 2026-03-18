import { useState, useRef } from 'react'
import { motion, AnimatePresence, type PanInfo } from 'framer-motion'

interface Props {
  images: string[]
  alt?: string
  /** When true, image fills its parent container instead of using a fixed 4:3 aspect ratio */
  fill?: boolean
}

const swipeConfidenceThreshold = 10_000
const swipePower = (offset: number, velocity: number) =>
  Math.abs(offset) * velocity

export default function ImageGallery({ images, alt = '', fill = false }: Props) {
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(0)
  const constraintsRef = useRef<HTMLDivElement>(null)

  // Ensure at least one image
  const photos = images.length > 0 ? images : []
  if (photos.length === 0) {
    return (
      <div className={`w-full bg-secondary rounded-t-[28px] ${fill ? 'h-full' : 'aspect-[4/3]'}`} />
    )
  }

  // Single image — no swipe needed
  if (photos.length === 1) {
    return (
      <img
        src={photos[0]}
        alt={alt}
        onError={(e) => {
          e.currentTarget.onerror = null
          e.currentTarget.style.opacity = '0'
        }}
        className={`w-full object-cover ${fill ? 'h-full' : 'aspect-[4/3]'}`}
      />
    )
  }

  const paginate = (newDirection: number) => {
    const next = index + newDirection
    if (next < 0 || next >= photos.length) return
    setDirection(newDirection)
    setIndex(next)
  }

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const swipe = swipePower(info.offset.x, info.velocity.x)
    if (swipe < -swipeConfidenceThreshold) {
      paginate(1)
    } else if (swipe > swipeConfidenceThreshold) {
      paginate(-1)
    }
  }

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? '100%' : '-100%',
      opacity: 0.5,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir < 0 ? '100%' : '-100%',
      opacity: 0.5,
    }),
  }

  return (
    <div className="relative w-full overflow-hidden" ref={constraintsRef}>
      {/* Photo counter badge */}
      <div className="absolute top-3 right-14 z-10 bg-black/40 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">
        {index + 1}/{photos.length}
      </div>

      {/* Swipeable image area */}
      <div className={`relative w-full overflow-hidden ${fill ? 'h-full' : 'aspect-[4/3]'}`}>
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.img
            key={`slide-${index}`}
            src={photos[index]}
            alt={`${alt} ${index + 1}`}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: 'spring', stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            onDragEnd={handleDragEnd}
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement
              target.onerror = null
              target.style.opacity = '0'
            }}
            className="absolute inset-0 w-full h-full object-cover cursor-grab active:cursor-grabbing"
          />
        </AnimatePresence>
      </div>

      {/* Dot indicators */}
      <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
        {photos.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              setDirection(i > index ? 1 : -1)
              setIndex(i)
            }}
            className={`rounded-full transition-all duration-200 ${
              i === index
                ? 'w-2 h-2 bg-background'
                : 'w-1.5 h-1.5 bg-background/50'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
