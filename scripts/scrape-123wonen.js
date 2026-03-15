/**
 * 123Wonen scraper — scrapes 123wonen.nl and upserts into Supabase
 *
 * Usage:
 *   node scrape-123wonen.js
 *   node scrape-123wonen.js --city Amsterdam --type apartment --max 1500
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
  // 123Wonen URL pattern: /huurwoningen/in/city
  let url = `https://www.123wonen.nl/huurwoningen/in/${citySlug}`
  // 123Wonen uses path-based filters, but price filtering is done via the site's
  // own range controls. We filter by price client-side after scraping.
  return url
}

function stableId(url) {
  return crypto.createHash('sha256').update(`123Wonen:${url}`).digest('hex').slice(0, 32)
}

function mapType(text) {
  const t = (text || '').toLowerCase()
  if (t.includes('kamer') && !t.includes('slaapkamer')) return 'Private room'
  if (t.includes('studio')) return 'Studio'
  if (t.includes('appartement') || t.includes('apartment')) return 'Apartment'
  if (t.includes('huis') || t.includes('woonhuis') || t.includes('eengezinswoning')) return 'House'
  return 'Apartment'
}

function mapFurnished(text) {
  const t = (text || '').toLowerCase()
  if (t.includes('gemeubileerd')) return 'Furnished'
  if (t.includes('gestoffeerd')) return 'Upholstered'
  if (t.includes('kaal') || t.includes('ongemeubileerd')) return 'Unfurnished'
  return null
}

async function scrapePage(page, url, city) {
  console.log(`\n  Fetching: ${url}`)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

  // Handle cookie consent
  const consent = page.locator('button:has-text("Accepteren"), button:has-text("Akkoord"), button:has-text("Accept")')
  if (await consent.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await consent.first().click()
    await page.waitForTimeout(1000)
  }

  // Wait for content and scroll to trigger lazy images
  await page.waitForTimeout(3000)
  for (let i = 0; i < 15; i++) {
    await page.evaluate(() => window.scrollBy(0, 400))
    await page.waitForTimeout(300)
  }

  const results = await page.evaluate((city) => {
    const cards = document.querySelectorAll('.pandlist-container')

    const seen = new Set()
    return Array.from(cards).map(card => {
      try {
        // URL from the detail link or onclick attribute
        const link = card.querySelector('a[href*="/huur/"]')
        let listingUrl = link?.getAttribute('href') || ''
        if (!listingUrl) {
          const onclick = card.getAttribute('onclick') || ''
          const urlMatch = onclick.match(/location\.href='([^']+)'/)
          if (urlMatch) listingUrl = urlMatch[1]
        }
        if (!listingUrl) return null
        if (!listingUrl.startsWith('http')) listingUrl = 'https://www.123wonen.nl' + listingUrl

        // Dedup
        if (seen.has(listingUrl)) return null
        seen.add(listingUrl)

        // Price: "€ 2.700,-" from .pand-price
        const priceEl = card.querySelector('.pand-price')
        const priceText = priceEl?.textContent || ''
        const priceMatch = priceText.match(/€\s*([\d.,]+)/)
        let price = 0
        if (priceMatch) {
          price = parseInt(priceMatch[1].replace(/\./g, '').replace(',', ''))
        }
        if (price <= 0 || price > 50000) return null

        // Title / slogan
        const sloganEl = card.querySelector('.pand-slogan span')
        const slogan = sloganEl?.textContent?.trim() || ''

        // Location: .pand-title contains "Amsterdam, " + .pand-address
        const titleEl = card.querySelector('.pand-title')
        const addressEl = card.querySelector('.pand-address')
        const titleText = titleEl?.textContent?.trim() || ''
        const street = addressEl?.textContent?.trim() || ''
        // neighborhood: use street name as neighborhood approximation
        const neighborhood = street || ''

        // Image from .pand-image (data-src for lazy loading, or background-image style)
        const imgEl = card.querySelector('.pand-image')
        let imageUrl = null
        if (imgEl) {
          imageUrl = imgEl.getAttribute('data-src') || null
          if (!imageUrl) {
            const style = imgEl.getAttribute('style') || ''
            const bgMatch = style.match(/url\(["']?([^"')]+)["']?\)/)
            if (bgMatch) imageUrl = bgMatch[1]
          }
        }

        // Specs from .pand-specs ul li
        const specItems = card.querySelectorAll('.pand-specs ul li')
        let listingType = 'Apartment'
        let furnished = null
        let rooms = null
        let size = null

        specItems.forEach(li => {
          const spans = li.querySelectorAll('span')
          if (spans.length < 2) return
          const label = (spans[0].textContent || '').trim().toLowerCase()
          const value = (spans[1].textContent || '').trim()

          if (label.includes('type')) {
            listingType = value
          } else if (label.includes('interieur')) {
            furnished = value
          } else if (label.includes('slaapkamer')) {
            const n = parseInt(value)
            if (!isNaN(n)) rooms = n
          } else if (label.includes('woonoppervlakte') || label.includes('oppervlakte')) {
            const m = value.match(/(\d+)/)
            if (m) size = parseInt(m[1])
          }
        })

        // Map type and furnished to standard values
        const mappedType = (() => {
          const t = listingType.toLowerCase()
          if (t.includes('kamer') && !t.includes('slaapkamer')) return 'Private room'
          if (t.includes('studio')) return 'Studio'
          if (t.includes('appartement') || t.includes('apartment')) return 'Apartment'
          if (t.includes('huis') || t.includes('woonhuis') || t.includes('eengezinswoning')) return 'House'
          return 'Apartment'
        })()

        const mappedFurnished = (() => {
          const f = (furnished || '').toLowerCase()
          if (f.includes('gemeubileerd')) return 'Furnished'
          if (f.includes('gestoffeerd')) return 'Upholstered'
          if (f.includes('kaal') || f.includes('ongemeubileerd')) return 'Unfurnished'
          return null
        })()

        const title = slogan || `${mappedType} in ${city}`

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
          listingType: mappedType,
          furnished: mappedFurnished,
        }
      } catch { return null }
    }).filter(Boolean)
  }, city)

  console.log(`  Found ${(results || []).length} listings`)
  return results || []
}

async function scrapeAllPages(page, startUrl, city, budgetMax, maxPages = 6) {
  const all = []
  let currentUrl = startUrl
  let pageNum = 1

  while (currentUrl && pageNum <= maxPages) {
    console.log(`\n📄 Page ${pageNum}`)
    const results = await scrapePage(page, currentUrl, city)
    all.push(...results)

    // 123Wonen pagination: a with href containing /page/N inside .productBrowser
    const nextHref = await page.evaluate(() => {
      const nextLink = document.querySelector('.productBrowser a[href*="/page/"]')
      // Only take "volgende" (next), not "vorige" (previous)
      if (!nextLink) return null
      const text = nextLink.textContent?.trim().toLowerCase() || ''
      if (text === 'vorige') {
        // If the first link is "vorige", check if there's a second link
        const links = document.querySelectorAll('.productBrowser a[href*="/page/"]')
        for (const l of links) {
          if ((l.textContent?.trim().toLowerCase() || '') !== 'vorige') {
            return l.getAttribute('href')
          }
        }
        return null
      }
      return nextLink.getAttribute('href')
    })

    if (nextHref && results.length > 0) {
      currentUrl = nextHref.startsWith('http') ? nextHref : `https://www.123wonen.nl${nextHref}`
      pageNum++
    } else {
      break
    }
  }

  // Filter by budget
  const filtered = all.filter(l => l.price <= budgetMax)
  if (filtered.length < all.length) {
    console.log(`\n  Filtered ${all.length} -> ${filtered.length} listings (budget max €${budgetMax})`)
  }
  return filtered
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
      source: '123Wonen',
      url: l.url,
      is_active: true,
      last_seen_at: now,
    }
    if (l.imageUrl) row.image_url = l.imageUrl
    return row
  })

  const { data, error } = await supabase.from('listings').upsert(rows, { onConflict: 'external_id' }).select('id')
  if (error) console.error('\n❌ Supabase error:', error.message)
  else console.log(`\n✅ Upserted ${data?.length ?? rows.length} listing(s) from 123Wonen`)
}

async function main() {
  const { cities, housingType, budgetMax } = parseCLI()
  console.log('━'.repeat(60))
  console.log('🏠  123Wonen Scraper — Roof')
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
    const results = await scrapeAllPages(page, url, city, budgetMax, 6)
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
