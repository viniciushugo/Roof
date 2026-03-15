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
  // Kamer.nl URL pattern: /huren/kamer-city/ (singular, NOT "kamers")
  // Type slugs: kamer (room), studio, appartement (apartment)
  let typePart = 'kamer' // default: rooms
  if (housingType === 'studio') typePart = 'studio'
  else if (housingType === 'apartment') typePart = 'appartement'
  else if (housingType === 'all') typePart = 'kamer'

  let url = `https://www.kamer.nl/huren/${typePart}-${citySlug}/`
  // Price filter param is "max_price" (underscore, not camelCase)
  if (budgetMax > 0) url += `?max_price=${budgetMax}`
  return url
}

function stableId(url) {
  return crypto.createHash('sha256').update(`Kamer.nl:${url}`).digest('hex').slice(0, 32)
}

async function dismissCookies(page) {
  // Kamer.nl uses Cookiebot — try multiple selectors
  const selectors = [
    'button:has-text("Accepteren")',
    'button:has-text("Alle cookies toestaan")',
    'button:has-text("Alles toestaan")',
    '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
    '#CybotCookiebotDialogBodyButtonDecline',
  ]
  for (const sel of selectors) {
    const btn = page.locator(sel).first()
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click()
      await page.waitForTimeout(500)
      return true
    }
  }
  return false
}

async function scrapePage(page, url, city) {
  console.log(`\n  Fetching: ${url}`)
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })

  // Check for redirect — if URL changed to /huren/ we lost the city filter
  const currentUrl = page.url()
  if (currentUrl === 'https://www.kamer.nl/huren/' || currentUrl === 'https://www.kamer.nl/huren') {
    console.log(`  ⚠️  Redirected to ${currentUrl} — city filter may not work with this URL`)
  }

  // Handle cookie consent (only on first page load)
  await dismissCookies(page)

  // Wait for listing cards to appear
  await page.waitForSelector('[class*="shadow-base"]', { timeout: 10_000 }).catch(() => {
    console.log('  ⚠️  No listing cards found after waiting')
  })

  // Scroll to trigger lazy-loaded images
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollBy(0, 500))
    await page.waitForTimeout(200)
  }

  // Primary extraction: parse listing cards from DOM
  const results = await page.evaluate((city) => {
    // Cards are divs with shadow-base class containing listing data
    const cards = document.querySelectorAll('[class*="shadow-base"]')

    const seen = new Set()
    return Array.from(cards).map(card => {
      try {
        // Get the listing link — main link has class "absolute inset-0"
        const link = card.querySelector('a[href*="/huren/"]')
        if (!link) return null
        const href = link.getAttribute('href') || ''
        if (!href || href === '/' || href === '#') return null

        // Must be an individual listing (has numeric ID in URL path)
        // Pattern: /huren/kamer-amsterdam/neighborhood/123456/
        const pathParts = href.replace(/\/$/, '').split('/')
        const lastPart = pathParts[pathParts.length - 1] || ''
        if (!/\d/.test(lastPart)) return null

        const listingUrl = href.startsWith('http') ? href : 'https://www.kamer.nl' + href

        // Dedup
        if (seen.has(listingUrl)) return null
        seen.add(listingUrl)

        const allText = card.textContent || ''

        // Price: look for "€ 675 p/m" pattern in the price element
        const priceEl = card.querySelector('p[class*="flex-none"]')
        const priceText = priceEl?.textContent?.trim() || ''
        const priceMatch = priceText.match(/€\s*([\d.,]+)/) || allText.match(/€\s*([\d.,]+)/)
        const price = priceMatch ? parseInt(priceMatch[1].replace(/[.,\s]/g, '')) : 0
        if (price <= 0 || price > 10000) return null

        // Location: "Neighborhood,City" from the location/title element
        const locationEl = card.querySelector('p[class*="overflow-hidden"]')
        const locationText = locationEl?.textContent?.trim() || ''
        let neighborhood = ''
        if (locationText.includes(',')) {
          neighborhood = locationText.split(',')[0].trim()
        }

        // If no neighborhood from element, try the link title attribute
        if (!neighborhood) {
          const linkTitle = link.getAttribute('title') || ''
          // "Kamer De Baarsjes in Amsterdam" -> "De Baarsjes"
          const titleMatch = linkTitle.match(/(?:Kamer|Studio|Appartement)\s+(.+?)\s+in\s+/i)
          if (titleMatch) neighborhood = titleMatch[1]
        }

        // If still no neighborhood, extract from URL
        if (!neighborhood) {
          // /huren/kamer-amsterdam/de-baarsjes/653297/ -> "de-baarsjes"
          if (pathParts.length >= 4) {
            const neighborhoodSlug = pathParts[pathParts.length - 2] || ''
            if (neighborhoodSlug && !/^\d+$/.test(neighborhoodSlug)) {
              neighborhood = neighborhoodSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
            }
          }
        }

        // Size: "14m²"
        const sizeMatch = allText.match(/(\d+)\s*m²/)
        const size = sizeMatch ? parseInt(sizeMatch[1]) : null

        // Rooms: "1 kamer"
        const roomsMatch = allText.match(/(\d+)\s*(?:kamer|bedroom|slaapkamer|room)/i)
        const rooms = roomsMatch ? parseInt(roomsMatch[1]) : null

        // Image: first non-icon img in the card
        const imgs = card.querySelectorAll('img')
        let imageUrl = null
        for (const img of imgs) {
          const src = img.getAttribute('src') || img.getAttribute('data-src') || ''
          if (src && !src.startsWith('data:') && !src.includes('/icons/') && src.includes('objectimage')) {
            imageUrl = src
            break
          }
        }

        // Type detection from URL
        let listingType = 'Private room'
        if (href.includes('/studio-') || href.includes('studio')) listingType = 'Studio'
        else if (href.includes('/appartement-') || href.includes('appartement')) listingType = 'Apartment'

        // Furnished detection from description text
        const textLower = allText.toLowerCase()
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
          imageUrl,
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

    // Pagination: kamer.nl uses ?page=N and "Volgende pagina" link
    const nextLink = page.locator('a:has-text("Volgende pagina")').first()
    const hasNext = await nextLink.isVisible({ timeout: 2000 }).catch(() => false)
    if (hasNext && results.length > 0) {
      const nextHref = await nextLink.getAttribute('href').catch(() => null)
      if (nextHref) {
        // Build absolute URL from relative href like "./?page=2"
        const base = page.url().split('?')[0]
        const params = nextHref.includes('?') ? nextHref.split('?')[1] : ''
        currentUrl = params ? `${base}?${params}` : base
        pageNum++
      } else {
        break
      }
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
    locale: 'nl-NL',
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
