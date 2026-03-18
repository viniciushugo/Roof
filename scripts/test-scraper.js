/**
 * Scraper test script — runs the Pararius scraper once and validates results.
 *
 * What this does:
 *   1. Runs the Pararius scraper (1 page only, fast mode)
 *   2. Logs every listing found: title, price, location, URL
 *   3. Validates required fields (no nulls on critical fields)
 *   4. Checks if each listing already exists in Supabase (dedup check)
 *   5. Prints a summary: found / new / duplicates / errors
 *
 * Usage:
 *   node scripts/test-scraper.js
 *   node scripts/test-scraper.js --city Rotterdam --type room --max 1000
 *
 * Required env vars (in scripts/.env):
 *   SUPABASE_URL          — Supabase project URL
 *   SUPABASE_SERVICE_KEY  — service_role key (bypasses RLS)
 *
 * Optional:
 *   DRY_RUN=true   — skip Supabase upsert, just validate scraped data
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') })
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.test') })

const { chromium } = require('playwright')
const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wzsdnhzsosonlcgubmxe.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const DRY_RUN = process.env.DRY_RUN === 'true'

const supabase = SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null

// ─── CLI args ─────────────────────────────────────────────────────────────────

function parseCLI() {
  const args = process.argv.slice(2)
  const get = (flag) => { const i = args.indexOf(flag); return i !== -1 && args[i + 1] ? args[i + 1] : null }
  return {
    city:   get('--city')  || 'Amsterdam',
    type:   get('--type')  || 'apartment',
    min:    parseInt(get('--min')  || '0'),
    max:    parseInt(get('--max')  || '1500'),
    pages:  parseInt(get('--pages') || '1'),  // default 1 page (fast test mode)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stableId(source, url) {
  return crypto.createHash('sha256').update(`${source}:${url}`).digest('hex').slice(0, 32)
}

const TYPE_MAP = { room: 'rooms', studio: 'apartments', apartment: 'apartments', all: 'apartments' }

function buildUrl(city, type, min, max) {
  const citySlug = city.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const typeSlug = TYPE_MAP[type] ?? 'apartments'
  const price = max > 0 ? `/${min}-${max}` : ''
  return `https://www.pararius.com/${typeSlug}/${citySlug}${price}`
}

// ─── Field validation ─────────────────────────────────────────────────────────

const REQUIRED_FIELDS = ['title', 'price', 'url']
const RECOMMENDED_FIELDS = ['location', 'imageUrl']

function validateListing(listing, index) {
  const errors = []
  const warnings = []

  for (const field of REQUIRED_FIELDS) {
    if (!listing[field]) errors.push(`Missing required field: ${field}`)
  }

  for (const field of RECOMMENDED_FIELDS) {
    if (!listing[field]) warnings.push(`Missing recommended field: ${field}`)
  }

  if (listing.price !== undefined && listing.price <= 0) {
    errors.push(`Invalid price: ${listing.price}`)
  }

  if (listing.url && !listing.url.startsWith('http')) {
    errors.push(`Invalid URL format: ${listing.url}`)
  }

  return { errors, warnings }
}

// ─── Scraper (single page, no DB write — pure extraction) ─────────────────────

async function scrapeOnePage(page, url) {
  console.log(`\n  Fetching: ${url}`)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

  // Accept cookies if prompted
  const consent = page.locator('button:has-text("Agree"), button:has-text("Accept"), button:has-text("Akkoord")')
  if (await consent.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await consent.first().click()
    await page.waitForTimeout(500)
  }

  // Scroll to trigger lazy-loaded images
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollBy(0, 500))
    await page.waitForTimeout(150)
  }

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
        const neighborhood = location.split('•').map(s => s.trim())[0] || null

        // Images
        const imageUrls = []
        const seen = new Set()
        item.querySelectorAll('source[srcset]').forEach(s => {
          const parts = (s.getAttribute('srcset') || '').split(',')
          const u = parts[parts.length - 1]?.trim().split(' ')[0]
          if (u?.startsWith('http') && !seen.has(u)) { seen.add(u); imageUrls.push(u) }
        })
        item.querySelectorAll('img.picture__image').forEach(img => {
          const src = img.getAttribute('src')
          if (src?.startsWith('http') && !seen.has(src)) { seen.add(src); imageUrls.push(src) }
        })

        let listingType = null
        if (url.includes('/apartments/')) listingType = 'Apartment'
        if (url.includes('/rooms/')) listingType = 'Private room'

        return title && url ? { title, price, priceText, location, neighborhood, url, imageUrl: imageUrls[0] || null, imageUrls, listingType } : null
      } catch { return null }
    }).filter(Boolean)
  })

  return results
}

// ─── Supabase dedup check ──────────────────────────────────────────────────────

async function checkDuplicates(listings) {
  if (!supabase) {
    console.log('  ⚠️  No Supabase connection — skipping dedup check')
    return { existing: [], newIds: listings.map(l => stableId('Pararius', l.url)) }
  }

  const ids = listings.map(l => stableId('Pararius', l.url))
  const { data, error } = await supabase
    .from('listings')
    .select('external_id')
    .in('external_id', ids)

  if (error) {
    console.error('  ❌ Supabase dedup query failed:', error.message)
    return { existing: [], newIds: ids }
  }

  const existingSet = new Set((data || []).map(r => r.external_id))
  const existing = listings.filter(l => existingSet.has(stableId('Pararius', l.url)))
  const newListings = listings.filter(l => !existingSet.has(stableId('Pararius', l.url)))

  return { existing, newListings }
}

// ─── Upsert (optional, only when not dry-run) ─────────────────────────────────

async function upsertListings(newListings, city) {
  if (!supabase) return { inserted: 0, error: null }
  if (DRY_RUN) { console.log('  🔵 DRY_RUN=true — skipping upsert'); return { inserted: 0, error: null } }

  const now = new Date().toISOString()
  const rows = newListings.map(l => ({
    external_id: stableId('Pararius', l.url),
    title: l.title,
    neighborhood: l.neighborhood || null,
    city,
    price: l.price,
    type: l.listingType || null,
    source: 'Pararius',
    url: l.url,
    image_url: l.imageUrl || null,
    is_active: true,
    last_seen_at: now,
  }))

  const { data, error } = await supabase
    .from('listings')
    .upsert(rows, { onConflict: 'external_id', ignoreDuplicates: false })
    .select('id')

  return { inserted: data?.length ?? rows.length, error: error?.message ?? null }
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { city, type, min, max, pages } = parseCLI()

  const divider = '━'.repeat(60)
  console.log(divider)
  console.log('🧪  Roof — Pararius Scraper Test')
  console.log(divider)
  console.log(`City       : ${city}`)
  console.log(`Type       : ${type}`)
  console.log(`Budget     : €${min} – €${max}/mo`)
  console.log(`Pages      : ${pages}`)
  console.log(`Supabase   : ${supabase ? '✅ connected' : '⚠️  no service key'}`)
  console.log(`Mode       : ${DRY_RUN ? '🔵 DRY RUN (no DB writes)' : '🟢 live'}`)
  console.log(divider)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    locale: 'en-US',
    viewport: { width: 1280, height: 800 },
  })
  const page = await context.newPage()

  let allListings = []
  let errors = []

  try {
    const url = buildUrl(city, type, min, max)
    console.log(`\n🔍 Scraping page 1 of ${pages}: ${url}`)
    const results = await scrapeOnePage(page, url)
    allListings = results.map(l => ({ ...l, city }))
  } catch (err) {
    errors.push(`Scrape failed: ${err.message}`)
    console.error('❌ Scrape error:', err.message)
  }

  await browser.close()

  // ─── Validate fields ──────────────────────────────────────────────────────

  console.log('\n' + divider)
  console.log(`📋 Validating ${allListings.length} listings...`)
  console.log(divider)

  let validCount = 0
  let invalidCount = 0

  allListings.forEach((listing, i) => {
    const { errors: fieldErrors, warnings } = validateListing(listing, i)

    const status = fieldErrors.length === 0 ? '✅' : '❌'
    console.log(`\n[${i + 1}] ${status} ${listing.title || '(no title)'}`)
    console.log(`    💰 ${listing.priceText || listing.price}  (parsed: €${listing.price})`)
    console.log(`    📍 ${listing.location || listing.city || '—'}`)
    console.log(`    🔗 ${listing.url || '—'}`)
    console.log(`    🖼️  ${listing.imageUrl ? listing.imageUrl.slice(0, 60) + '...' : '(no image)'}`)

    if (fieldErrors.length > 0) {
      fieldErrors.forEach(e => console.log(`    ❌ ERROR: ${e}`))
      errors.push(`Listing ${i + 1}: ${fieldErrors.join(', ')}`)
      invalidCount++
    } else {
      validCount++
    }

    if (warnings.length > 0) {
      warnings.forEach(w => console.log(`    ⚠️  ${w}`))
    }
  })

  // ─── Dedup check ──────────────────────────────────────────────────────────

  console.log('\n' + divider)
  console.log('🔍 Checking for duplicates in Supabase...')
  console.log(divider)

  const { existing, newListings } = await checkDuplicates(allListings)
  const existingCount = existing?.length ?? 0
  const newCount = newListings?.length ?? allListings.length

  console.log(`  Already in DB : ${existingCount}`)
  console.log(`  New listings  : ${newCount}`)

  if (existing?.length > 0) {
    console.log('\n  Duplicates (already in DB):')
    existing.slice(0, 5).forEach(l => console.log(`    • ${l.title}`))
    if (existing.length > 5) console.log(`    ... and ${existing.length - 5} more`)
  }

  // ─── Upsert new listings ──────────────────────────────────────────────────

  let inserted = 0
  if (newListings?.length > 0) {
    console.log('\n🚀 Upserting new listings to Supabase...')
    const result = await upsertListings(newListings, city)
    inserted = result.inserted
    if (result.error) errors.push(`Upsert error: ${result.error}`)
  }

  // ─── Summary ──────────────────────────────────────────────────────────────

  console.log('\n' + divider)
  console.log('📊  SUMMARY')
  console.log(divider)
  console.log(`Total listings found   : ${allListings.length}`)
  console.log(`Valid (all fields ok)  : ${validCount}`)
  console.log(`Invalid (missing fields): ${invalidCount}`)
  console.log(`Already in DB (skipped): ${existingCount}`)
  console.log(`New listings inserted  : ${DRY_RUN ? '0 (dry run)' : inserted}`)
  console.log(`Errors encountered     : ${errors.length}`)

  if (errors.length > 0) {
    console.log('\n❌ Errors:')
    errors.forEach(e => console.log(`  • ${e}`))
  }

  console.log(divider)

  if (allListings.length === 0) {
    console.log('\n⚠️  No listings found. Possible causes:')
    console.log('  • Pararius blocked the request (try running with a different user agent)')
    console.log('  • The search URL returned no results (try different city/type/budget)')
    console.log('  • Network connectivity issue')
    process.exit(1)
  }

  process.exit(errors.length > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message)
  process.exit(1)
})
