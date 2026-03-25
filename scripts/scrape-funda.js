/**
 * Funda scraper — fetches funda.nl rental listings via their search API
 *
 * Usage:
 *   node scrape-funda.js
 *   node scrape-funda.js --city Amsterdam --max 1500
 *
 * Note: Funda blocks Playwright entirely (bot protection). This scraper
 * uses their public search endpoint that returns JSON, which doesn't
 * require browser rendering.
 *
 * Required env: SUPABASE_SERVICE_KEY
 */

require('dotenv').config()
const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')
const uploadImage = require('./lib/upload-image')
const { geocodeAddress, determinePrecision, buildAddressRaw } = require('./lib/geocode')

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wzsdnhzsosonlcgubmxe.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

let supabase = null
if (SUPABASE_SERVICE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
}

const DEFAULTS = {
  cities: ['Amsterdam'],
  budgetMax: 1500,
}

function parseCLI() {
  const args = process.argv.slice(2)
  const get = (flag) => { const i = args.indexOf(flag); return i !== -1 && args[i + 1] ? args[i + 1] : null }
  return {
    cities: get('--city') ? [get('--city')] : DEFAULTS.cities,
    budgetMax: get('--max') ? parseInt(get('--max')) : DEFAULTS.budgetMax,
  }
}

function stableId(url) {
  return crypto.createHash('sha256').update(`Funda:${url}`).digest('hex').slice(0, 32)
}

async function fetchFundaListings(city, budgetMax, page = 1) {
  const citySlug = city.toLowerCase()
  // Funda's search API endpoint (returns JSON when Accept header requests it)
  const searchUrl = `https://www.funda.nl/zoeken/huur/?selected_area=%5B%22${citySlug}%22%5D&price=%220-${budgetMax}%22&object_type=%5B%22apartment%22,%22house%22%5D&search_result=${page}`

  console.log(`  Fetching page ${page}: ${searchUrl.slice(0, 80)}...`)

  const res = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
      'Referer': 'https://www.funda.nl/',
    },
  })

  if (!res.ok) {
    console.log(`  ❌ Funda returned ${res.status} — bot protection active`)
    return []
  }

  const html = await res.text()

  // Check for bot protection page
  if (html.includes('Je bent bijna op de pagina') || html.includes('we soms verifiëren')) {
    console.log('  ❌ Funda bot protection — cannot scrape via HTTP either')
    console.log('  ℹ️  Funda requires manual browser sessions or API access')
    return []
  }

  // Parse listings from HTML using regex (no browser needed)
  const results = []

  // Funda embeds listing data in script tags as JSON-LD or in the HTML
  // Try to find listing links and data from the HTML
  const listingRegex = /href="(\/huur\/[^"]+\/(\d+)[^"]*)"[^>]*>/g
  const foundUrls = new Set()
  let match
  while ((match = listingRegex.exec(html)) !== null) {
    const path = match[1]
    if (!foundUrls.has(path)) {
      foundUrls.add(path)
    }
  }

  // Try to extract listing data from Next.js __NEXT_DATA__ if present
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s)
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1])
      const searchResults = nextData?.props?.pageProps?.searchResults || []

      for (const item of searchResults) {
        const listingUrl = item.url ? `https://www.funda.nl${item.url}` : null
        if (!listingUrl) continue

        const title = item.address || item.title || ''
        const price = item.price?.rentPrice || item.price?.value || 0
        const imageUrl = item.mainPhoto || item.photo || null
        const size = item.floorArea || item.livingArea || null
        const neighborhood = item.location?.neighbourhood || item.location?.city || city

        // Extract structured address fields from Funda JSON-LD / Next data
        const street = item.address?.streetName || item.streetName || null
        const streetNumber = item.address?.houseNumber || item.houseNumber || null
        const postcode = item.address?.postcode || item.postcode || item.location?.postalCode || null
        const fundaCity = item.address?.city || item.location?.city || city

        if (title && price > 0) {
          results.push({
            title,
            price,
            priceText: `€${price}/mo`,
            url: listingUrl,
            imageUrl,
            size,
            city: fundaCity,
            neighborhood,
            street,
            streetNumber: streetNumber ? String(streetNumber) : null,
            postcode,
          })
        }
      }
    } catch (e) {
      console.log('  ⚠️ Could not parse __NEXT_DATA__:', e.message)
    }
  }

  // Fallback: try to extract basic listing info from HTML patterns
  if (results.length === 0) {
    // Look for structured data in the page
    const ldJsonMatches = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/gs) || []
    for (const ldMatch of ldJsonMatches) {
      try {
        const jsonStr = ldMatch.replace(/<\/?script[^>]*>/g, '')
        const ld = JSON.parse(jsonStr)
        if (ld['@type'] === 'ItemList' && ld.itemListElement) {
          for (const item of ld.itemListElement) {
            const obj = item.item || item
            if (obj.name && obj.url) {
              results.push({
                title: obj.name,
                price: parseInt((obj.offers?.price || '0').toString().replace(/[^0-9]/g, '')) || 0,
                priceText: obj.offers?.price || '0',
                url: obj.url.startsWith('http') ? obj.url : `https://www.funda.nl${obj.url}`,
                imageUrl: obj.image || null,
                size: null,
                city,
                neighborhood: city,
              })
            }
          }
        }
      } catch { /* skip */ }
    }
  }

  return results
}

async function upsertListings(listings) {
  if (!supabase) { console.log('\n⚠️  No SUPABASE_SERVICE_KEY — skipping upsert'); return }
  const now = new Date().toISOString()
  const seen = new Set()
  const unique = listings.filter((l) => { const id = stableId(l.url); if (seen.has(id)) return false; seen.add(id); return true })

  if (unique.length === 0) {
    console.log('\n  No listings to upsert')
    return
  }

  console.log('\n📸 Uploading images & geocoding...')
  const rows = []
  for (const l of unique) {
    const extId = stableId(l.url)
    const hostedImageUrl = await uploadImage(supabase, extId, l.imageUrl, 'https://www.funda.nl/')
    if (hostedImageUrl) process.stdout.write('.')

    // Geocode the address
    const precision = determinePrecision({ street: l.street, number: l.streetNumber, postcode: l.postcode, neighbourhood: l.neighborhood })
    const addressRaw = buildAddressRaw({ street: l.street, number: l.streetNumber, postcode: l.postcode, city: l.city, neighbourhood: l.neighborhood })
    const coords = await geocodeAddress(addressRaw, precision)

    const row = {
      external_id: extId,
      title: l.title,
      neighborhood: l.neighborhood,
      city: l.city,
      price: l.price,
      type: 'Apartment',
      size: l.size,
      source: 'Funda',
      url: l.url,
      image_url: hostedImageUrl || l.imageUrl,
      is_active: true,
      last_seen_at: now,
      address_raw: addressRaw || null,
      address_precision: precision,
    }
    if (coords) {
      row.lat = coords.lat
      row.lng = coords.lng
      row.geocoded_at = now
      row.geocode_attempts = 1
    }
    rows.push(row)
  }
  console.log()

  const { data, error } = await supabase.from('listings').upsert(rows, { onConflict: 'external_id' }).select('id')
  if (error) console.error('\n❌ Supabase error:', error.message)
  else console.log(`\n✅ Upserted ${data?.length ?? rows.length} listing(s) from Funda`)
}

async function main() {
  const { cities, budgetMax } = parseCLI()
  console.log('━'.repeat(60))
  console.log('🏠  Funda Scraper — Roof')
  console.log('━'.repeat(60))
  console.log(`Cities : ${cities.join(', ')}`)
  console.log(`Max    : €${budgetMax}/mo`)
  console.log(`DB     : ${supabase ? '✅ connected' : '⚠️  no service key'}`)
  console.log('━'.repeat(60))

  const all = []

  for (const city of cities) {
    console.log(`\n🔍 Searching in ${city}...`)
    // Try pages 1-3
    for (let page = 1; page <= 3; page++) {
      const results = await fetchFundaListings(city, budgetMax, page)
      if (results.length === 0) break
      all.push(...results)
      console.log(`  Page ${page}: ${results.length} listings`)
    }
  }

  console.log('\n' + '━'.repeat(60))
  console.log(`✅  Found ${all.length} listing(s)`)
  console.log('━'.repeat(60))
  all.forEach((l, i) => {
    console.log(`\n[${i + 1}] ${l.title}`)
    console.log(`    💰 ${l.priceText}  (€${l.price})`)
    console.log(`    🔗 ${l.url}`)
  })

  await upsertListings(all)
  console.log('\n' + '━'.repeat(60))
}

main().catch((err) => { console.error('\n❌ Error:', err.message); process.exit(1) })
