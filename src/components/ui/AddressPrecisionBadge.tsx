interface Props {
  precision: 'exact' | 'postcode' | 'neighbourhood' | 'city' | null
}

export default function AddressPrecisionBadge({ precision }: Props) {
  if (!precision || precision === 'exact') return null

  const label = precision === 'postcode' ? '~ postcode area' : precision === 'neighbourhood' ? '~ neighbourhood' : null
  if (!label) return null

  return (
    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full">
      {label}
    </span>
  )
}
