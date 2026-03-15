/**
 * Huurstunt scraper — scrapes huurstunt.nl and upserts into Supabase
 *
 * Usage:
 *   node scrape-huurstunt.js
 *   node scrape-huurstunt.js --city Amsterdam --type apartment --max 1500
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
  // Huurstunt URL pattern: /huren/city
  // Filtering is done via sidebar on the page; URL supports basic city slug
  let url = `https://www.huurstunt.nl/huren/${citySlug}`
  return url
}

function stableId(url) {
  return crypto.createHash('sha256').update(`Huurstunt:${url}`).digest('hex').slice(0, 32)
}

function mapType(urlOrText) {
  const t = (urlOrText || '').toLowerCase()
  if (t.includes('studio')) return 'Studio'
  if (t.includes('kamer') && !t.includes('slaapkamer')) return 'Private room'
  if (t.includes('appartement') || t.includes('apartment')) return 'Apartment'
  if (t.includes('huurwoning') || t.includes('huis')) return 'House'
  return 'Apartment'
}

async function scrapePage(page, url, city, budgetMax) {
  console.log(`\n  Fetching: ${url}`)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

  // Handle cookie consent
  const consent = page.locator('button:has-text("OK"), button:has-text("Accepteren"), button:has-text("Alle cookies")')
  if (await consent.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await consent.first().click()
    await page.waitForTimeout(1000)
  }

  // Wait for content and scroll to lazy-load all listings
  await page.waitForTimeout(3000)
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => window.scrollBy(0, 500))
    await page.waitForTimeout(300)
  }

  const results = await page.evaluate((args) => {
    const { city, budgetMax } = args
    // Huurstunt uses article.z-20 for loaded listing cards
    const cards = document.querySelectorAll('article.z-20')

    const seen = new Set()
    return Array.from(cards).map(card => {
      try {
        // Find the listing link ("Meer zien" link)
        const link = card.querySelector('a[href*="huren/in"]')
        const href = link?.getAttribute('href') || ''
        if (!href) return null
        const listingUrl = href.startsWith('http') ? href : 'https://www.huurstunt.nl' + href

        // Dedup
        if (seen.has(listingUrl)) return null
        seen.add(listingUrl)

        const allText = card.textContent || ''

        // Price: "€ 2.350" or "€ 1.750"
        const priceMatch = allText.match(/€\s*([\d.,]+)/)
        let price = 0
        if (priceMatch) {
          price = parseInt(priceMatch[1].replace(/\./g, '').replace(',', ''))
        }
        if (price <= 0 || price > 10000) return null

        // Budget filter
        if (budgetMax > 0 && price > budgetMax) return null

        // Size: "72 m2" or "65 m2"
        const sizeMatch = allText.match(/(\d+)\s*m2/i)
        const size = sizeMatch ? parseInt(sizeMatch[1]) : null

        // Rooms: "3 kamers" or "2 kamers"
        const roomsMatch = allText.match(/(\d+)\s*kamer/i)
        const rooms = roomsMatch ? parseInt(roomsMatch[1]) : null

        // Street name from h3
        const h3 = card.querySelector('h3')
        const streetName = h3 ? h3.textContent.trim() : ''

        // Image
        const imgEl = card.querySelector('img[src*="rental-images"]')
        const imageUrl = imgEl?.getAttribute('src') || null

        // Type from URL path: /appartement/, /studio/, /huurwoning/, /kamer/
        const listingType = (() => {
          const u = listingUrl.toLowerCase()
          if (u.includes('/studio/')) return 'Studio'
          if (u.includes('/kamer/')) return 'Private room'
          if (u.includes('/huurwoning/')) return 'House'
          return 'Apartment'
        })()

        // Location: city name from the card text
        const locationSpan = card.querySelector('ul li:last-child span')
        const location = locationSpan ? locationSpan.textContent.trim() : city

        // Furnished: check card text
        const textLower = allText.toLowerCase()
        let furnished = null
        if (textLower.includes('gemeubileerd') || textLower.includes('furnished')) furnished = true
        if (textLower.includes('ongemeubileerd') || textLower.includes('unfurnished')) furnished = false

        const title = streetName ? `${streetName}, ${location}` : `${listingType} in ${location}`

        return {
          title,
          price,
          priceText: `€${price}`,
          url: listingUrl,
          imageUrl: imageUrl && !imageUrl.startsWith('data:') ? imageUrl : null,
          size,
          rooms,
          city: location || city,
          neighborhood: streetName || '',
          listingType,
          furnished,
        }
      } catch { return null }
    }).filter(Boolean)
  }, { city, budgetMax })

  console.log(`  Found ${(results || []).length} listings`)
  return results || []
}

async function scrapeAllPages(page, startUrl, city, budgetMax, maxPages = 3) {
  const all = []
  let currentUrl = startUrl
  let pageNum = 1

  while (currentUrl && pageNum <= maxPages) {
    console.log(`\n📄 Page ${pageNum}`)
    const results = await scrapePage(page, currentUrl, city, budgetMax)
    all.push(...results)

    // Huurstunt doesn't have traditional pagination — all listings load on one page
    // No next page to navigate to
    break
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
      source: 'Huurstunt',
      url: l.url,
      is_active: true,
      last_seen_at: now,
    }
    if (l.imageUrl) row.image_url = l.imageUrl
    return row
  })

  const { data, error } = await supabase.from('listings').upsert(rows, { onConflict: 'external_id' }).select('id')
  if (error) console.error('\n❌ Supabase error:', error.message)
  else console.log(`\n✅ Upserted ${data?.length ?? rows.length} listing(s) from Huurstunt`)
}

async function main() {
  const { cities, housingType, budgetMax } = parseCLI()
  console.log('━'.repeat(60))
  console.log('🏠  Huurstunt Scraper — Roof')
  console.log('━'.repeat(60))
  console.log(`Cities : ${cities.join(', ')}`)
  console.log(`Type   : ${housingType}`)
  console.log(`Max    : €${budgetMax}/mo`)
  console.log(`DB     : ${supabase ? '✅ connected' : '⚠️  no service key'}`)
  console.log('━'.repeat(60))

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    locale: 'nl-NL',
    viewport: { width: 1280, height: 800 },
  })
  const page = await context.newPage()
  const all = []

  for (const city of cities) {
    console.log(`\n🔍 Searching in ${city}...`)
    const url = buildSearchUrl(city, housingType, budgetMax)
    const results = await scrapeAllPages(page, url, city, budgetMax, 3)
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
