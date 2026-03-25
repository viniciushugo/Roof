import { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react'
import { Plus, Minus } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import { Listing } from '../../data/listings'
import { getCached, buildQuery, batchGeocode } from '../../lib/geocoder'
import MapListingCard from './MapListingCard'

// ── Dutch city center coordinates (immediate fallback) ────────────────────────
const CITY_COORDS: Record<string, [number, number]> = {
  'Amsterdam': [52.3676, 4.9041],
  'Rotterdam': [51.9225, 4.4792],
  'The Hague': [52.0705, 4.3007],
  'Den Haag': [52.0705, 4.3007],
  'Utrecht': [52.0907, 5.1214],
  'Eindhoven': [51.4416, 5.4697],
  'Groningen': [53.2194, 6.5665],
  'Tilburg': [51.5555, 5.0913],
  'Almere': [52.3508, 5.2647],
  'Breda': [51.5719, 4.7683],
  'Nijmegen': [51.8126, 5.8372],
  'Haarlem': [52.3874, 4.6462],
  'Arnhem': [51.9851, 5.8987],
  'Enschede': [52.2215, 6.8937],
  'Amersfoort': [52.1561, 5.3878],
  'Apeldoorn': [52.2112, 5.9699],
  'Leiden': [52.1601, 4.4970],
  'Delft': [52.0116, 4.3571],
  'Dordrecht': [51.8133, 4.6901],
  'Maastricht': [50.8514, 5.6910],
  'Zwolle': [52.5168, 6.0830],
  'Deventer': [52.2660, 6.1552],
  'Leeuwarden': [53.2012, 5.7999],
  'Den Bosch': [51.6978, 5.3037],
  "'s-Hertogenbosch": [51.6978, 5.3037],
  'Hilversum': [52.2292, 5.1765],
  'Hoofddorp': [52.3025, 4.6890],
  'Wageningen': [51.9692, 5.6653],
  'Diemen': [52.3397, 4.9594],
  'Amstelveen': [52.3114, 4.8546],
  'Zaandam': [52.4389, 4.8266],
}

// Small jitter for city-level fallback
function jitter(coords: [number, number]): [number, number] {
  return [
    coords[0] + (Math.random() - 0.5) * 0.006,
    coords[1] + (Math.random() - 0.5) * 0.006,
  ]
}

/**
 * Get initial coords for a listing (before Nominatim geocoding).
 * 1. Check geocoder cache (accurate, from previous Nominatim calls)
 * 2. Use DB lat/lng if available
 * 3. Fall back to city center with jitter
 */
function getInitialCoords(listing: Listing): [number, number] | null {
  // Check Nominatim cache first
  const { key } = buildQuery(listing.city, listing.neighborhood)
  const cached = getCached(key)
  if (cached) return [cached.lat, cached.lng]

  // DB coordinates
  if (listing.lat && listing.lng) return [listing.lat, listing.lng]

  // City center fallback
  const cityCoords = CITY_COORDS[listing.city]
  if (cityCoords) return jitter(cityCoords)

  return null
}

// ── Price pill DivIcon ────────────────────────────────────────────────────────
function pricePillIcon(price: number, isSelected: boolean) {
  const label = price >= 1000 ? `€${(price / 1000).toFixed(1)}k` : `€${price}`
  return L.divIcon({
    className: 'roof-marker-wrapper',
    iconSize: L.point(0, 0),
    iconAnchor: L.point(0, 0),
    html: `<div class="roof-price-pill${isSelected ? ' roof-price-pill--active' : ''}">${label}</div>`,
  })
}

// ── Cluster icon ──────────────────────────────────────────────────────────────
function clusterIcon(cluster: L.MarkerCluster) {
  const count = cluster.getChildCount()
  return L.divIcon({
    className: 'roof-marker-wrapper',
    iconSize: L.point(40, 40),
    iconAnchor: L.point(20, 20),
    html: `<div class="roof-cluster">${count}</div>`,
  })
}

interface Props {
  listings: Listing[]
  onSelectListing: (listing: Listing) => void
  isSaved: (id: string) => boolean
  onToggleSave: (id: string) => void
}

const MapView = memo(function MapView({ listings, onSelectListing, isSaved, onToggleSave }: Props) {
  const [selected, setSelected] = useState<Listing | null>(null)
  const [geocoding, setGeocoding] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  const prevDataKeyRef = useRef('')

  // ── Initialize map ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [52.2, 5.3],
      zoom: 8,
      zoomControl: false,
      attributionControl: false,
    })

    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    L.tileLayer(
      isDark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      { maxZoom: 19, subdomains: 'abcd' }
    ).addTo(map)

    map.on('click', () => setSelected(null))
    mapRef.current = map
    setTimeout(() => map.invalidateSize(), 100)

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // ── Build markers + progressive geocoding ─────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const abort = new AbortController()

    // Remove old cluster
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current)
    }

    const cluster = L.markerClusterGroup({
      maxClusterRadius: 50,
      iconCreateFunction: clusterIcon,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 16,
      chunkedLoading: true,
    })

    const newMarkers = new Map<string, L.Marker>()
    const bounds: [number, number][] = []
    const needsGeocode: Array<{ id: string; city: string; neighborhood: string }> = []

    // Phase 1: Place markers at best available position immediately
    for (const listing of listings) {
      const coords = getInitialCoords(listing)
      if (!coords) continue

      const marker = L.marker(coords, {
        icon: pricePillIcon(listing.price, false),
      })
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e)
        setSelected(listing)
      })
      ;(marker as any)._roofListing = listing
      newMarkers.set(listing.id, marker)
      cluster.addLayer(marker)
      bounds.push(coords)

      // Check if this listing needs Nominatim geocoding
      const { key } = buildQuery(listing.city, listing.neighborhood)
      if (!getCached(key) && !listing.lat && listing.neighborhood) {
        needsGeocode.push({ id: listing.id, city: listing.city, neighborhood: listing.neighborhood })
      }
    }

    map.addLayer(cluster)
    clusterRef.current = cluster
    markersRef.current = newMarkers

    // Fit bounds only when dataset changes
    const dataKey = listings.map(l => l.id).join(',')
    if (bounds.length > 0 && dataKey !== prevDataKeyRef.current) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 13, animate: true })
      prevDataKeyRef.current = dataKey
    }

    // Phase 2: Progressive geocoding — update marker positions as results come in
    if (needsGeocode.length > 0) {
      setGeocoding(true)
      batchGeocode(
        needsGeocode,
        (id, coords) => {
          if (abort.signal.aborted) return
          const marker = newMarkers.get(id)
          if (marker && clusterRef.current) {
            clusterRef.current.removeLayer(marker)
            marker.setLatLng([coords.lat, coords.lng])
            clusterRef.current.addLayer(marker)
          }
        },
        abort.signal,
      ).finally(() => {
        if (!abort.signal.aborted) setGeocoding(false)
      })
    }

    return () => abort.abort()
  }, [listings])

  // ── Update selected marker highlight ──────────────────────────────────────
  useEffect(() => {
    for (const [id, marker] of markersRef.current) {
      const listing = (marker as any)._roofListing as Listing
      marker.setIcon(pricePillIcon(listing.price, selected?.id === id))
    }

    if (selected && mapRef.current) {
      const coords = getInitialCoords(selected)
      if (coords) mapRef.current.panTo(coords, { animate: true })
    }
  }, [selected])

  const handleZoomIn = useCallback(() => mapRef.current?.zoomIn(), [])
  const handleZoomOut = useCallback(() => mapRef.current?.zoomOut(), [])

  const mappedCount = listings.filter(l => getInitialCoords(l) !== null).length
  const unmappedCount = listings.length - mappedCount

  return (
    <div className="relative flex-1 w-full overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />

      {/* Status badge — only show if some listings can't be mapped */}
      {unmappedCount > 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000]">
          <div className="bg-background/90 backdrop-blur-sm text-muted text-xs font-medium px-3 py-1.5 rounded-full border border-border">
            {unmappedCount} not shown (unknown location)
          </div>
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1">
        <button
          onClick={handleZoomIn}
          className="w-9 h-9 bg-background rounded-xl border border-border shadow-sm flex items-center justify-center active:bg-secondary transition-colors"
        >
          <Plus size={16} strokeWidth={2} className="text-foreground" />
        </button>
        <button
          onClick={handleZoomOut}
          className="w-9 h-9 bg-background rounded-xl border border-border shadow-sm flex items-center justify-center active:bg-secondary transition-colors"
        >
          <Minus size={16} strokeWidth={2} className="text-foreground" />
        </button>
      </div>

      {/* Selected listing card */}
      <MapListingCard
        listing={selected}
        onOpen={(l) => {
          onSelectListing(l)
          setSelected(null)
        }}
        onClose={() => setSelected(null)}
        isSaved={selected ? isSaved(selected.id) : false}
        onToggleSave={() => {
          if (selected) onToggleSave(selected.id)
        }}
      />
    </div>
  )
})

export default MapView
