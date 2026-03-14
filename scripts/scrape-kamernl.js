/**
 * Kamer.nl scraper — scrapes kamer.nl and upserts into Supabase
 *
 * Usage:
 *   node scrape-kamernl.js
 *   node scrape-kamernl.js --city Amsterdam --max 1500
 *
 * Required env: SUPABASE_SERVICE_KEY
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') })
const { chromium } = require('playwright')
const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wzsdnhzsosonlcgubmxe.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

let supabase = null
if (SUPABASE_SERVICE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
}

const DEFAULTS = { cities: ['Amsterdam'], housingType: 'all', budgetMax: 1500 }

function parseCLI() {
  const args = process.argv.slice(2)
  const get = (flag) => { const i = args.indexOf(flag); return i !== -1 && args[i + 1] ? args[i + 1] : null }
  return {
    cities: get('--city') ? [get('--city')] : DEFAULTS.cities,
    housingType: get('--type') || DEFAULTS.housingType,
    budgetMax: get('--max') ? parseInt(get('--max')) : DEFAULTS.budgetMax,
  }
}

function buildSearchUrl(city, housingType, budgetMax) {
  const citySlug = city.toLowerCase().replace(/\s+/g, '-')
  // Kamer.nl URL: /huren/kamers-city or /huren/studio-city etc.
  let typePart = 'kamers' // default: rooms
  if (housingType === 'studio') typePart = 'studio'
  else if (housingType === 'apartment') typePart = 'appartementen'
  else if (housingType === 'all') typePart = 'kamers'

  let url = `https://www.kamer.nl/huren/${typePart}-${citySlug}/`
  if (budgetMax > 0) url += `?maxPrice=${budgetMax}`
  return url
}

function stableId(url) {
  return crypto.createHash('sha256').update(`Kamer.nl:${url}`).digest('hex').slice(0, 32)
}

async function scrapePage(page, url, city) {
  console.log(`\n  Fetching: ${url}`)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

  // Handle cookie consent
  const consent = page.locator('button:has-text("Accept"), button:has-text("Akkoord"), button:has-text("Accepteren"), [id*="cookie"] button')
  if (await consent.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await consent.first().click()
    await page.waitForTimeout(500)
  }

  // Wait for content and scroll to lazy-load
  await page.waitForTimeout(3000)
  for (let i = 0; i < 15; i++) {
    await page.evaluate(() => window.scrollBy(0, 400))
    await page.waitForTimeout(300)
  }

  const results = await page.evaluate((city) => {
    // Kamer.nl uses listing cards — try multiple selectors
    const cards = document.querySelectorAll(
      '[class*="listing"], [class*="Listing"], [class*="result-item"], [class*="ResultItem"], ' +
      '[class*="property-card"], [class*="PropertyCard"], article[class*="card"], ' +
      'a[href*="/huren/kamer-"], a[href*="/huren/studio-"], a[href*="/huren/appartement-"]'
    )

    const seen = new Set()
    return Array.from(cards).map(card => {
      try {
        // Get the listing link
        let href = ''
        if (card.tagName === 'A') {
          href = card.getAttribute('href') || ''
        } else {
          const link = card.querySelector('a[href*="/huren/"]')
          href = link?.getAttribute('href') || ''
        }
        if (!href || href === '/' || href === '#') return null
        // Skip category/search pages (short paths)
        if (href.match(/^\/huren\/[a-z]+-[a-z]+\/?$/) && !href.includes('kamer-') && !href.includes('studio-') && !href.includes('appartement-')) return null

        const listingUrl = href.startsWith('http') ? href : 'https://www.kamer.nl' + href

        // Dedup
        if (seen.has(listingUrl)) return null
        seen.add(listingUrl)

        const allText = card.textContent || ''

        // Price: "€ 750" or "€750" or "750 per maand"
        const priceMatch = allText.match(/€\s*([\d.,\s]+)/)
        const price = priceMatch ? parseInt(priceMatch[1].replace(/[.,\s]/g, '')) : 0
        if (price <= 0 || price > 10000) return null

        // Size
        const sizeMatch = allText.match(/(\d+)\s*m²/)
        const size = sizeMatch ? parseInt(sizeMatch[1]) : null

        // Rooms
        const roomsMatch = allText.match(/(\d+)\s*(?:kamer|bedroom|slaapkamer|room)/i)
        const rooms = roomsMatch ? parseInt(roomsMatch[1]) : null

        // Image
        const imgEl = card.querySelector('img')
        const imageUrl = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || null

        // Type detection from URL and text
        let listingType = 'Private room' // kamer.nl is primarily rooms
        const textLower = allText.toLowerCase()
        if (href.includes('studio-') || textLower.includes('studio')) listingType = 'Studio'
        else if (href.includes('appartement-') || textLower.includes('appartement') || textLower.includes('apartment')) listingType = 'Apartment'

        // Neighborhood from text
        let neighborhood = ''
        // Try to extract from structured elements
        const locationEl = card.querySelector('[class*="location"], [class*="address"], [class*="Location"], [class*="Address"]')
        if (locationEl) {
          neighborhood = locationEl.textContent.trim()
        }
        if (!neighborhood) {
          // Try from URL slug: /huren/kamer-amsterdam-de-pijp-123
          const urlParts = href.replace(/\/$/, '').split('/')
          const lastPart = urlParts[urlParts.length - 1] || ''
          // Remove type prefix and city, keep neighborhood
          const parts = lastPart.split('-')
          // Skip first part (kamer/studio/appartement) and try to find neighborhood
          if (parts.length > 3) {
            // Remove type (kamer) and city (amsterdam) and ID (numbers at end)
            const withoutType = parts.slice(1) // remove kamer/studio/etc
            const withoutId = withoutType.filter(p => !/^\d+$/.test(p)) // remove numeric IDs
            // Remove city name
            const cityLower = city.toLowerCase()
            const withoutCity = withoutId.filter(p => p !== cityLower)
            if (withoutCity.length > 0) {
              neighborhood = withoutCity.join(' ').replace(/\b\w/g, c => c.toUpperCase())
            }
          }
        }

        // Furnished detection
        let furnished = null
        if (textLower.includes('gemeubileerd') || textLower.includes('furnished')) furnished = 'furnished'
        else if (textLower.includes('gestoffeerd') || textLower.includes('upholstered')) furnished = 'upholstered'
        else if (textLower.includes('ongemeubileerd') || textLower.includes('unfurnished')) furnished = 'unfurnished'

        const title = neighborhood ? `${listingType} in ${neighborhood}` : `${listingType} in ${city}`

        return {
          title,
          price,
          priceText: `€${price}`,
          url: listingUrl,
          imageUrl: imageUrl && !imageUrl.startsWith('data:') ? imageUrl : null,
          size,
          rooms,
          city,
          neighborhood,
          listingType,
          furnished,
        }
      } catch { return null }
    }).filter(Boolean)
  }, city)

  console.log(`  Found ${(results || []).length} listings`)
  return results || []
}

async function scrapeAllPages(page, startUrl, city, maxPages = 3) {
  const all = []
  let currentUrl = startUrl
  let pageNum = 1

  while (currentUrl && pageNum <= maxPages) {
    console.log(`\n📄 Page ${pageNum}`)
    const results = await scrapePage(page, currentUrl, city)
    all.push(...results)

    // Try pagination
    const nextBtn = page.locator('a[rel="next"], a:has-text("Volgende"), a:has-text("Next"), button:has-text("Volgende"), [class*="pagination"] a:last-child').first()
    const hasNext = await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)
    if (hasNext && results.length > 0) {
      await nextBtn.click()
      await page.waitForTimeout(3000)
      currentUrl = page.url()
      pageNum++
    } else {
      break
    }
  }
  return all
}

async function upsertListings(listings) {
  if (!supabase) { console.log('\n⚠️  No SUPABASE_SERVICE_KEY — skipping upsert'); return }
  const now = new Date().toISOString()
  const seen = new Set()
  const unique = listings.filter((l) => { const id = stableId(l.url); if (seen.has(id)) return false; seen.add(id); return true })

  const rows = unique.map((l) => {
    const extId = stableId(l.url)
    const row = {
      external_id: extId,
      title: l.title || `${l.listingType || 'Listing'} in ${l.city}`,
      neighborhood: l.neighborhood,
      city: l.city,
      price: l.price,
      type: l.listingType,
      size: l.size,
      rooms: l.rooms,
      furnished: l.furnished,
      source: 'Kamer.nl',
      url: l.url,
      is_active: true,
      last_seen_at: now,
    }
    if (l.imageUrl) row.image_url = l.imageUrl
    return row
  })

  const { data, error } = await supabase.from('listings').upsert(rows, { onConflict: 'external_id' }).select('id')
  if (error) console.error('\n❌ Supabase error:', error.message)
  else console.log(`\n✅ Upserted ${data?.length ?? rows.length} listing(s) from Kamer.nl`)
}

async function main() {
  const { cities, housingType, budgetMax } = parseCLI()
  console.log('━'.repeat(60))
  console.log('🏠  Kamer.nl Scraper — Roof')
  console.log('━'.repeat(60))
  console.log(`Cities : ${cities.join(', ')}`)
  console.log(`Type   : ${housingType}`)
  console.log(`Max    : €${budgetMax}/mo`)
  console.log(`DB     : ${supabase ? '✅ connected' : '⚠️  no service key'}`)
  console.log('━'.repeat(60))

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    locale: 'en-US',
    viewport: { width: 1280, height: 800 },
  })
  const page = await context.newPage()
  const all = []

  for (const city of cities) {
    console.log(`\n🔍 Searching in ${city}...`)
    const url = buildSearchUrl(city, housingType, budgetMax)
    const results = await scrapeAllPages(page, url, city, 3)
    all.push(...results)
  }

  await browser.close()

  console.log('\n' + '━'.repeat(60))
  console.log(`✅  Found ${all.length} listing(s)`)
  console.log('━'.repeat(60))
  all.forEach((l, i) => {
    console.log(`\n[${i + 1}] ${l.title}`)
    console.log(`    💰 ${l.priceText}  (€${l.price})`)
    console.log(`    📍 ${l.neighborhood || l.city}`)
    console.log(`    🔗 ${l.url}`)
  })

  await upsertListings(all)
  console.log('\n' + '━'.repeat(60))
}

main().catch((err) => { console.error('\n❌ Error:', err.message); process.exit(1) })
