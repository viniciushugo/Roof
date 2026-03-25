/**
 * Kamernet scraper — scrapes kamernet.nl and upserts into Supabase
 *
 * Usage:
 *   node scrape-kamernet.js
 *   node scrape-kamernet.js --city Amsterdam --type room --max 1200
 *
 * Required env: SUPABASE_SERVICE_KEY
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') })
const { chromium } = require('playwright')
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

const DEFAULTS = { cities: ['Amsterdam'], housingType: 'room', budgetMax: 1500 }

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
  const typePath = { room: 'rooms', studio: 'studios', apartment: 'apartments', all: 'properties' }
  const tp = typePath[housingType] ?? 'properties'
  const priceParam = budgetMax > 0 ? `?maxRent=${budgetMax}` : ''
  return `https://kamernet.nl/en/for-rent/${tp}-${citySlug}${priceParam}`
}

function stableId(url) {
  return crypto.createHash('sha256').update(`Kamernet:${url}`).digest('hex').slice(0, 32)
}

function parsePrice(text) {
  return parseInt(text.replace(/[^0-9]/g, '')) || 0
}

function mapType(text) {
  const t = (text || '').toLowerCase().trim()
  if (t === 'room') return 'Private room'
  if (t === 'studio') return 'Studio'
  if (t === 'apartment') return 'Apartment'
  return 'Private room'
}

async function scrapePage(page, url, city) {
  console.log(`\n  Fetching: ${url}`)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

  const consent = page.locator('button:has-text("Accept"), button:has-text("Akkoord"), #onetrust-accept-btn-handler')
  if (await consent.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await consent.first().click()
    await page.waitForTimeout(500)
  }

  await page.waitForSelector('.MuiCard-root, [class*="SearchResultCard"]', { timeout: 10_000 }).catch(() => {})

  // Extract all data in one evaluate call (fast)
  const results = await page.evaluate((city) => {
    function mapType(text) {
      const t = (text || '').toLowerCase().trim()
      if (t === 'room') return 'Private room'
      if (t === 'studio') return 'Studio'
      if (t === 'apartment') return 'Apartment'
      return 'Private room'
    }

    const cards = document.querySelectorAll('a.MuiCard-root[href*="/for-rent/"]')
    return Array.from(cards).map(card => {
      try {
        const href = card.getAttribute('href') || ''
        const listingUrl = href ? (href.startsWith('http') ? href : 'https://kamernet.nl' + href) : ''

        const imageUrl = card.querySelector('img')?.getAttribute('src') || null

        const subtitleSpans = card.querySelectorAll('span[class*="subtitle"]')
        const street = (subtitleSpans[0]?.textContent || '').trim().replace(/,$/, '')
        const listingCity = (subtitleSpans[1]?.textContent || '').trim() || city
        const title = street ? street + ', ' + listingCity : listingCity

        const pTexts = Array.from(card.querySelectorAll('p')).map(p => p.textContent || '')
        const sizeText = pTexts.find(t => t.includes('m²')) || ''
        const size = parseInt(sizeText.replace(/[^0-9]/g, '')) || null
        const typeText = pTexts.find(t => /^(Room|Apartment|Studio)$/i.test(t.trim())) || ''
        const listingType = mapType(typeText)
        const furnishedText = pTexts.find(t => /^(furnished|unfurnished|upholstered)$/i.test(t.trim())) || ''
        const furnished = furnishedText.toLowerCase().trim() || null

        const priceText = (card.querySelector('span[class*="h5"]')?.textContent || '').trim()
        const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0

        return title && listingUrl && price > 0 ? { title, price, priceText, url: listingUrl, imageUrl, size, city: listingCity, neighborhood: street, listingType, furnished } : null
      } catch { return null }
    }).filter(Boolean)
  }, city)

  console.log(`  Found ${results.length} listings`)
  return results
}

async function scrapeAllPages(page, startUrl, city, maxPages = 3) {
  const all = []
  let currentUrl = startUrl
  let pageNum = 1

  while (currentUrl && pageNum <= maxPages) {
    console.log(`\n📄 Page ${pageNum}`)
    const results = await scrapePage(page, currentUrl, city)
    all.push(...results)

    const nextBtn = page.locator('a[aria-label="Go to next page"], button[aria-label="Go to next page"]').first()
    const hasNext = await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)
    if (hasNext && results.length > 0) {
      await nextBtn.click()
      await page.waitForTimeout(2000)
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

  console.log('\n  Geocoding listings...')
  const rows = []
  for (const l of unique) {
    const extId = stableId(l.url)
    // Kamernet: neighborhood is the street name, city is city
    const precision = determinePrecision({ street: l.neighborhood, number: null, postcode: null, neighbourhood: l.neighborhood })
    const addressRaw = buildAddressRaw({ street: l.neighborhood, number: null, postcode: null, city: l.city, neighbourhood: l.neighborhood })
    const coords = await geocodeAddress(addressRaw, precision)

    const row = {
      external_id: extId,
      title: l.title,
      neighborhood: l.neighborhood,
      city: l.city,
      price: l.price,
      type: l.listingType,
      size: l.size,
      furnished: l.furnished,
      source: 'Kamernet',
      url: l.url,
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
      process.stdout.write('.')
    }
    if (l.imageUrl) row.image_url = l.imageUrl
    rows.push(row)
  }
  console.log()

  const { data, error } = await supabase.from('listings').upsert(rows, { onConflict: 'external_id' }).select('id')
  if (error) console.error('\n❌ Supabase error:', error.message)
  else console.log(`\n✅ Upserted ${data?.length ?? rows.length} listing(s) from Kamernet`)
}

async function main() {
  const { cities, housingType, budgetMax } = parseCLI()
  console.log('━'.repeat(60))
  console.log('🏠  Kamernet Scraper — Roof')
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
    console.log(`    📍 ${l.neighborhood}`)
    console.log(`    🔗 ${l.url}`)
  })

  await upsertListings(all)
  console.log('\n' + '━'.repeat(60))
}

main().catch((err) => { console.error('\n❌ Error:', err.message); process.exit(1) })
