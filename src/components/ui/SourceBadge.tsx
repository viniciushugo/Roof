type Source = 'Pararius' | 'Kamernet' | 'Huurwoningen' | 'Funda' | 'HousingAnywhere' | 'DirectWonen' | 'Rentola' | 'Kamer.nl'

const BADGE_STYLES: Record<Source, { bg: string; text: string }> = {
  Pararius:        { bg: 'bg-blue-50',    text: 'text-blue-700'    },
  Kamernet:        { bg: 'bg-red-50',     text: 'text-red-700'     },
  Huurwoningen:    { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  Funda:           { bg: 'bg-orange-50',  text: 'text-orange-700'  },
  HousingAnywhere: { bg: 'bg-purple-50',  text: 'text-purple-700'  },
  DirectWonen:     { bg: 'bg-cyan-50',    text: 'text-cyan-700'    },
  Rentola:         { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700' },
  'Kamer.nl':      { bg: 'bg-amber-50',   text: 'text-amber-700'   },
}

export default function SourceBadge({ source }: { source: Source }) {
  const style = BADGE_STYLES[source] ?? { bg: 'bg-secondary', text: 'text-muted' }
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${style.bg} ${style.text}`}
    >
      {source}
    </span>
  )
}
