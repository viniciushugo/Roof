/**
 * Geocode an address string using OpenStreetMap Nominatim.
 * Rate limited to 1 request per 1.1 seconds.
 *
 * Usage in scrapers:
 *   const { geocodeAddress } = require('./lib/geocode')
 *   const result = await geocodeAddress('Herengracht 100, 1015 BS, Amsterdam')
 *   // → { lat: 52.3702, lng: 4.8908 }
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'Roof Housing App / hello@getroof.app'
const RATE_LIMIT_MS = 1100

let lastRequest = 0

async function geocodeAddress(addressRaw, precision) {
  // Don't geocode city-only — too imprecise for map pins
  if (precision === 'city') return null

  // Rate limit
  const now = Date.now()
  const wait = RATE_LIMIT_MS - (now - lastRequest)
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  lastRequest = Date.now()

  const query = addressRaw + ', Netherlands'
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=nl`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT }
    })
    if (!res.ok) return null

    const data = await res.json()
    if (!data || data.length === 0) return null

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    }
  } catch (err) {
    console.log(`  ⚠️ Geocode failed for "${addressRaw}": ${err.message}`)
    return null
  }
}

/**
 * Determine address precision from extracted fields.
 * @param {Object} fields - { street, number, postcode, city, neighbourhood }
 * @returns {'exact'|'postcode'|'neighbourhood'|'city'}
 */
function determinePrecision({ street, number, postcode, neighbourhood }) {
  if (street && number && postcode) return 'exact'
  if (street && postcode) return 'exact'
  if (postcode) return 'postcode'
  if (neighbourhood || street) return 'neighbourhood'
  return 'city'
}

/**
 * Build a raw address string from extracted fields.
 */
function buildAddressRaw({ street, number, postcode, city, neighbourhood }) {
  const parts = []
  if (street) {
    parts.push(number ? `${street} ${number}` : street)
  }
  if (postcode) parts.push(postcode)
  if (neighbourhood && !street) parts.push(neighbourhood)
  if (city) parts.push(city)
  return parts.join(', ')
}

module.exports = { geocodeAddress, determinePrecision, buildAddressRaw }
