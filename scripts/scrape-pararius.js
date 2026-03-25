/**
 * Pararius scraper — scrapes listings and upserts them into Supabase
 *
 * Usage:
 *   node scrape-pararius.js
 *   node scrape-pararius.js --city Amsterdam --type apartment --max 1500
 *
 * Required env vars (set in .env or inline):
 *   SUPABASE_URL      — your project URL
 *   SUPABASE_SERVICE_KEY — service_role key (from Supabase Settings → API)
 *
 * Install deps first: npm install && npx playwright install chromium
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') })
const { chromium } = require('playwright')
const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')
const uploadImage = require('./lib/upload-image')
const { geocodeAddress, determinePrecision, buildAddressRaw } = require('./lib/geocode')

// ---------------------------------------------------------------------------
// Supabase client (service role — bypasses RLS to allow scraper writes)
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wzsdnhzsosonlcgubmxe.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '' // set via env

let supabase = null
if (SUPABASE_SERVICE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
}

// ---------------------------------------------------------------------------
// Config — edit these to match your Roof app preferences, or pass CLI args
// ---------------------------------------------------------------------------
const DEFAULTS = {
  cities: ['Amsterdam'],
  housingType: 'apartment', // 'room' | 'studio' | 'apartment' | 'all'
  budgetMin: 0,
  budgetMax: 1500,
}

// ---------------------------------------------------------------------------
// CLI arg parsing  --city Amsterdam --type room --min 500 --max 1200
// ---------------------------------------------------------------------------
function parseCLI() {
  const args = process.argv.slice(2)
  const get = (flag) => {
    const i = args.indexOf(flag)
    return i !== -1 && args[i + 1] ? args[i + 1] : null
  }
  return {
    cities: get('--city') ? [get('--city')] : DEFAULTS.cities,
    housingType: get('--type') || DEFAULTS.housingType,
    budgetMin: get('--min') ? parseInt(get('--min')) : DEFAULTS.budgetMin,
    budgetMax: get('--max') ? parseInt(get('--max')) : DEFAULTS.budgetMax,
  }
}

// ---------------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------------
const TYPE_MAP = {
  room: 'rooms',
  studio: 'apartments',
  apartment: 'apartments',
  all: 'apartments',
}

// Maps Pararius listing type text → app type
const LISTING_TYPE_MAP = {
  'apartment': 'Apartment',
  'studio': 'Studio',
  'room': 'Private room',
  'shared room': 'Shared room',
  'house': 'Apartment',
}

function buildSearchUrl(city, housingType, budgetMin, budgetMax) {
  const citySlug = city.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const typeSlug = TYPE_MAP[housingType] ?? 'apartments'
  const priceSegment = budgetMax > 0 ? `/${budgetMin}-${budgetMax}` : ''
  return `https://www.pararius.com/${typeSlug}/${citySlug}${priceSegment}`
}

function stableId(source, url) {
  return crypto.createHash('sha256').update(`${source}:${url}`).digest('hex').slice(0, 32)
}

function parsePrice(text) {
  const cleaned = text.split('\n')[0].replace(/[^0-9]/g, '')
  return parseInt(cleaned) || 0
}

// ---------------------------------------------------------------------------
// Scraper
// ---------------------------------------------------------------------------
async function scrapePage(page, url) {
  console.log(`\n  Fetching: ${url}`)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

  // Handle cookie consent if it appears
  const consentBtn = page.locator('button:has-text("Agree"), button:has-text("Accept"), button:has-text("Akkoord")')
  if (await consentBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await consentBtn.first().click()
    await page.waitForTimeout(500)
  }

  // Scroll down to trigger lazy-loading of images
  for (let i = 0; i < 15; i++) {
    await page.evaluate(() => window.scrollBy(0, 500))
    await page.waitForTimeout(200)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(300)

  // Extract all data in one evaluate call (much faster than individual locator calls)
  // Use only section.listing-search-item to avoid duplicate li+section matches
  const results = await page.evaluate(() => {
    const items = document.querySelectorAll('section.listing-search-item')
    return Array.from(items).map(item => {
      try {
        const titleEl = item.querySelector('a.listing-search-item__link--title, h2.listing-search-item__title a')
        const title = titleEl?.textContent?.trim() || ''
        const href = titleEl?.getAttribute('href') || ''
        const url = href ? (href.startsWith('http') ? href : 'https://www.pararius.com' + href) : ''

        const priceText = (item.querySelector('.listing-search-item__price')?.textContent || '').trim()
        const price = parseInt(priceText.split('\n')[0].replace(/[^0-9]/g, '')) || 0

        const location = (item.querySelector('.listing-search-item__sub-title, .listing-search-item__location')?.textContent || '').trim()

        const sizeText = (item.querySelector('.illustrated-features__item--surface-area')?.textContent || '').trim()
        const size = parseInt(sizeText.replace(/[^0-9]/g, '')) || null

        const roomsText = (item.querySelector('.illustrated-features__item--number-of-rooms')?.textContent || '').trim()
        const rooms = parseInt(roomsText.replace(/[^0-9]/g, '')) || null

        // Collect ALL images from the listing card (srcset sources + img tags)
        const imageUrls = []
        const seenUrls = new Set()
        item.querySelectorAll('source[srcset]').forEach(source => {
          const srcset = source.getAttribute('srcset')
          if (srcset) {
            const parts = srcset.split(',')
            const url = parts[parts.length - 1].trim().split(' ')[0]
            if (url && url.startsWith('http') && !seenUrls.has(url)) {
              seenUrls.add(url)
              imageUrls.push(url)
            }
          }
        })
        item.querySelectorAll('img.picture__image, img[class*="picture"]').forEach(img => {
          const src = img.getAttribute('src')
          if (src && src.startsWith('http') && !seenUrls.has(src)) {
            seenUrls.add(src)
            imageUrls.push(src)
          }
        })
        const imageUrl = imageUrls[0] || null

        const neighborhood = location.split('•').map(s => s.trim())[0] || null

        // Parse address from location text
        const locationText = location || ''
        const postcodeMatch = locationText.match(/(\d{4})\s?([A-Z]{2})/)
        const postcode = postcodeMatch ? `${postcodeMatch[1]} ${postcodeMatch[2]}` : null
        const streetMatch = locationText.match(/^([^,]+)/)
        const street = streetMatch ? streetMatch[1].trim() : null
        const numberMatch = street ? street.match(/\d+/) : null
        const streetNumber = numberMatch ? numberMatch[0] : null

        let listingType = null
        if (url.includes('/apartments/') || url.includes('/studio/')) listingType = 'Apartment'
        if (url.includes('/rooms/')) listingType = 'Private room'

        return title && url ? { title, price, priceText, location, neighborhood, size, rooms, url, imageUrl, imageUrls, listingType, postcode, street, streetNumber } : null
      } catch { return null }
    }).filter(Boolean)
  })

  console.log(`  Found ${results.length} listings`)
  return results
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------
async function scrapeAllPages(page, startUrl, maxPages = 5) {
  const allResults = []
  let currentUrl = startUrl
  let pageNum = 1

  while (currentUrl && pageNum <= maxPages) {
    console.log(`\n📄 Page ${pageNum}`)
    const results = await scrapePage(page, currentUrl)
    allResults.push(...results)

    const nextLink = page.locator('a[rel="next"], a:has-text("Volgende"), li.pagination__item--next a').first()
    const hasNext = await nextLink.isVisible({ timeout: 2000 }).catch(() => false)

    if (hasNext && results.length > 0) {
      const nextHref = await nextLink.getAttribute('href').catch(() => null)
      currentUrl = nextHref
        ? nextHref.startsWith('http') ? nextHref : `https://www.pararius.com${nextHref}`
        : null
      pageNum++
    } else {
      break
    }
  }

  return allResults
}

// ---------------------------------------------------------------------------
// Detail-page image scraper — visits each listing to grab full gallery
// ---------------------------------------------------------------------------
async function scrapeDetailImages(page, listings, maxDetail = 20) {
  const toVisit = listings.slice(0, maxDetail)
  console.log(`\n  Fetching detail images for up to ${toVisit.length} listings...`)

  for (const listing of toVisit) {
    try {
      await page.goto(listing.url, { waitUntil: 'domcontentloaded', timeout: 20_000 })
      // Scroll a bit to trigger lazy-loaded images
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollBy(0, 400))
        await page.waitForTimeout(150)
      }

      const images = await page.evaluate(() => {
        const urls = new Set()
        // Pararius detail pages use picture > source[srcset] and img tags in the gallery
        document.querySelectorAll('.listing-detail-summary__photo source[srcset], .swiper source[srcset], .listing-photos source[srcset], [class*="gallery"] source[srcset], [class*="carousel"] source[srcset]').forEach(s => {
          const srcset = s.getAttribute('srcset')
          if (srcset) {
            const parts = srcset.split(',')
            const url = parts[parts.length - 1].trim().split(' ')[0]
            if (url && url.startsWith('http')) urls.add(url)
          }
        })
        document.querySelectorAll('.listing-detail-summary__photo img, .swiper img, .listing-photos img, [class*="gallery"] img, [class*="carousel"] img').forEach(img => {
          const src = img.getAttribute('src')
          if (src && src.startsWith('http') && !src.includes('placeholder') && !src.includes('logo')) urls.add(src)
        })
        return Array.from(urls)
      })

      if (images.length > 0) {
        listing.imageUrls = images
        listing.imageUrl = listing.imageUrl || images[0]
        console.log(`    ${listing.title.slice(0, 40)}... — ${images.length} images`)
      }
    } catch (err) {
      // Non-fatal: keep the listing with whatever images we already have
      console.log(`    Skipped detail page: ${err.message.slice(0, 60)}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Supabase upsert
// ---------------------------------------------------------------------------
async function upsertListings(listings) {
  if (!supabase) {
    console.log('\n⚠️  SUPABASE_SERVICE_KEY not set — skipping database upsert')
    return
  }

  const now = new Date().toISOString()
  // Deduplicate by external_id (same URL can appear multiple times in scrape)
  const seen = new Set()
  const unique = listings.filter((l) => {
    const id = stableId('Pararius', l.url)
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })

  // Store external image URL first; batch-upload via fix-images.js afterward
  // Only include image_url when we have one — never overwrite existing hosted images with null
  console.log('\n  Geocoding listings...')
  const rows = []
  for (const l of unique) {
    const extId = stableId('Pararius', l.url)
    const precision = determinePrecision({ street: l.street, number: l.streetNumber, postcode: l.postcode, neighbourhood: l.neighborhood })
    const addressRaw = buildAddressRaw({ street: l.street, number: l.streetNumber, postcode: l.postcode, city: l.city, neighbourhood: l.neighborhood })
    const coords = await geocodeAddress(addressRaw, precision)

    const row = {
      external_id: extId,
      title: l.title,
      neighborhood: l.neighborhood,
      city: l.city,
      price: l.price,
      type: l.listingType,
      size: l.size,
      rooms: l.rooms,
      furnished: null,
      source: 'Pararius',
      url: l.url,
      available_from: null,
      description: null,
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
    if (l.imageUrls && l.imageUrls.length > 0) row.images = JSON.stringify(l.imageUrls)
    rows.push(row)
  }
  console.log()

  const { data, error } = await supabase
    .from('listings')
    .upsert(rows, {
      onConflict: 'external_id',
      ignoreDuplicates: false, // update last_seen_at on re-run
    })
    .select('id')

  if (error) {
    console.error('\n❌ Supabase upsert error:', error.message)
  } else {
    console.log(`\n✅ Upserted ${data?.length ?? rows.length} listing(s) to Supabase`)
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const { cities, housingType, budgetMin, budgetMax } = parseCLI()

  console.log('━'.repeat(60))
  console.log('🏠  Pararius Scraper — Roof')
  console.log('━'.repeat(60))
  console.log(`Cities     : ${cities.join(', ')}`)
  console.log(`Type       : ${housingType}`)
  console.log(`Budget     : €${budgetMin} – €${budgetMax}/mo`)
  console.log(`Supabase   : ${supabase ? '✅ connected' : '⚠️  no service key (console only)'}`)
  console.log('━'.repeat(60))

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    locale: 'en-US',
    viewport: { width: 1280, height: 800 },
  })
  const page = await context.newPage()

  const allListings = []

  for (const city of cities) {
    console.log(`\n🔍 Searching in ${city}...`)
    const url = buildSearchUrl(city, housingType, budgetMin, budgetMax)
    const listings = await scrapeAllPages(page, url, 3)
    allListings.push(...listings.map((l) => ({ ...l, city })))
  }

  // Visit detail pages to scrape full image galleries
  await scrapeDetailImages(page, allListings, 20)

  await browser.close()

  // ---------------------------------------------------------------------------
  // Output
  // ---------------------------------------------------------------------------
  console.log('\n' + '━'.repeat(60))
  console.log(`✅  Found ${allListings.length} listing${allListings.length !== 1 ? 's' : ''}`)
  console.log('━'.repeat(60))

  if (allListings.length === 0) {
    console.log('\nNo results. Try adjusting your criteria or check the URL manually.')
    return
  }

  allListings.forEach((l, i) => {
    console.log(`\n[${i + 1}] ${l.title}`)
    console.log(`    💰 ${l.priceText}  (parsed: €${l.price})`)
    console.log(`    📍 ${l.location || l.city}`)
    console.log(`    🔗 ${l.url}`)
  })

  // Upsert to Supabase
  await upsertListings(allListings)

  console.log('\n' + '━'.repeat(60))
}

main().catch((err) => {
  console.error('\n❌ Scraper error:', err.message)
  process.exit(1)
})
