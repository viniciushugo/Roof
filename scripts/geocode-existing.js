/**
 * Retroactive geocoding — geocodes existing listings that don't have lat/lng.
 * Runs as a standalone script. Respects Nominatim rate limit (1 req/1.1s).
 *
 * Usage:
 *   node geocode-existing.js
 *   node geocode-existing.js --limit 100
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') })
const { createClient } = require('@supabase/supabase-js')
const { geocodeAddress } = require('./lib/geocode')

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wzsdnhzsosonlcgubmxe.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY is required')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

function parseCLI() {
  const args = process.argv.slice(2)
  const i = args.indexOf('--limit')
  return { limit: i !== -1 && args[i + 1] ? parseInt(args[i + 1]) : 500 }
}

async function main() {
  const { limit } = parseCLI()

  console.log('━'.repeat(60))
  console.log('📍 Retroactive Geocoding — Roof')
  console.log('━'.repeat(60))
  console.log(`Limit: ${limit} listings`)

  // Fetch listings without coordinates and under 3 attempts
  const { data: listings, error } = await supabase
    .from('listings')
    .select('id, title, neighborhood, city, address_raw, address_precision, geocode_attempts')
    .eq('is_active', true)
    .is('lat', null)
    .lt('geocode_attempts', 3)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('❌ Failed to fetch listings:', error.message)
    process.exit(1)
  }

  console.log(`Found ${listings.length} listings to geocode\n`)

  let success = 0
  let failed = 0
  let skipped = 0

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i]

    // Build query from best available data
    let query = listing.address_raw
    let precision = listing.address_precision || 'neighbourhood'

    if (!query) {
      // Fall back to neighborhood + city
      if (listing.neighborhood) {
        query = `${listing.neighborhood}, ${listing.city}`
        precision = 'neighbourhood'
      } else {
        query = listing.city
        precision = 'city'
      }
    }

    if (precision === 'city') {
      // Skip city-only — too imprecise
      await supabase
        .from('listings')
        .update({ geocode_attempts: (listing.geocode_attempts || 0) + 1 })
        .eq('id', listing.id)
      skipped++
      continue
    }

    console.log(`[${i + 1}/${listings.length}] ${listing.title}`)
    console.log(`  Query: ${query} (${precision})`)

    const coords = await geocodeAddress(query, precision)

    if (coords) {
      const { error: updateErr } = await supabase
        .from('listings')
        .update({
          lat: coords.lat,
          lng: coords.lng,
          address_raw: query,
          address_precision: precision,
          geocoded_at: new Date().toISOString(),
          geocode_attempts: (listing.geocode_attempts || 0) + 1,
        })
        .eq('id', listing.id)

      if (updateErr) {
        console.log(`  ❌ DB update failed: ${updateErr.message}`)
        failed++
      } else {
        console.log(`  ✅ ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`)
        success++
      }
    } else {
      await supabase
        .from('listings')
        .update({
          geocode_attempts: (listing.geocode_attempts || 0) + 1,
        })
        .eq('id', listing.id)
      console.log(`  ⚠️ No result`)
      failed++
    }
  }

  console.log('\n' + '━'.repeat(60))
  console.log(`✅ Success: ${success}`)
  console.log(`❌ Failed:  ${failed}`)
  console.log(`⏭️ Skipped: ${skipped} (city-only)`)
  console.log(`📊 Rate:    ${listings.length > 0 ? ((success / listings.length) * 100).toFixed(1) : 0}%`)
  console.log('━'.repeat(60))
}

main().catch((err) => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
