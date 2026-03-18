/**
 * Pre-launch checklist — runs all critical health checks before App Store submission.
 *
 * Checks:
 *   ✅ Supabase connection is working
 *   ✅ All required tables exist: listings, profiles, alerts, saved_listings
 *   ✅ Resend API key is configured and working (sends a test email)
 *   ✅ Playwright scraper can reach pararius.com without being blocked
 *   ✅ Playwright scraper can reach kamernet.nl without being blocked
 *   ✅ Environment variables are all set
 *   ✅ At least 1 listing exists in the database
 *
 * Usage:
 *   node scripts/pre-launch-check.js
 *   TEST_EMAIL=hugo@example.com node scripts/pre-launch-check.js
 *
 * Required env vars (scripts/.env or ../.env.test):
 *   SUPABASE_URL          — Supabase project URL
 *   SUPABASE_SERVICE_KEY  — service_role key
 *   RESEND_API_KEY        — Resend API key (optional — skips email test if not set)
 *   TEST_EMAIL            — email address to send the Resend test to
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') })
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.test') })

const { createClient } = require('@supabase/supabase-js')
const { chromium } = require('playwright')

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wzsdnhzsosonlcgubmxe.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const TEST_EMAIL = process.env.TEST_EMAIL || ''

const REQUIRED_ENV_VARS = [
  { name: 'SUPABASE_URL',         value: SUPABASE_URL,         source: 'scripts/.env' },
  { name: 'SUPABASE_SERVICE_KEY', value: SUPABASE_SERVICE_KEY, source: 'scripts/.env' },
  { name: 'SUPABASE_ANON_KEY',    value: SUPABASE_ANON_KEY,    source: '.env.local or scripts/.env' },
  { name: 'RESEND_API_KEY',       value: RESEND_API_KEY,       source: 'scripts/.env (optional)' },
]

const REQUIRED_TABLES = ['listings', 'profiles', 'alerts', 'saved_listings']

// ─── Check result tracker ──────────────────────────────────────────────────────

const checks = []
function pass(name, detail = '') { checks.push({ pass: true, name, detail }); console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`) }
function fail(name, detail = '') { checks.push({ pass: false, name, detail }); console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`) }
function warn(name, detail = '') { checks.push({ pass: null, name, detail }); console.log(`  ⚠️  ${name}${detail ? ` — ${detail}` : ''}`) }

// ─── Check 1: Environment variables ───────────────────────────────────────────

async function checkEnvVars() {
  console.log('\n📋  Environment Variables')

  let allSet = true
  for (const v of REQUIRED_ENV_VARS) {
    if (v.value) {
      const preview = v.name.includes('KEY') ? v.value.slice(0, 8) + '...' : v.value
      pass(`${v.name} is set`, preview)
    } else {
      const optional = v.source.includes('optional')
      const check = optional ? warn : fail
      check(`${v.name} is not set`, `expected in ${v.source}`)
      if (!optional) allSet = false
    }
  }

  return allSet
}

// ─── Check 2: Supabase connection ─────────────────────────────────────────────

async function checkSupabaseConnection() {
  console.log('\n🔌  Supabase Connection')

  if (!SUPABASE_SERVICE_KEY) {
    fail('Supabase connection', 'SUPABASE_SERVICE_KEY not set — cannot test')
    return false
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    // Simple health check: query a single row from listings
    const { error } = await supabase.from('listings').select('id').limit(1)
    if (error) throw new Error(error.message)
    pass('Supabase connection is working', SUPABASE_URL)
    return true
  } catch (err) {
    fail('Supabase connection failed', err.message)
    return false
  }
}

// ─── Check 3: Required tables ─────────────────────────────────────────────────

async function checkTables() {
  console.log('\n🗄️   Database Tables')

  // Note: The Roof schema uses: listings, profiles, alerts, saved_listings
  // (not "users", "search_preferences", or "notifications" — those are different naming)

  if (!SUPABASE_SERVICE_KEY) {
    warn('Table check skipped', 'SUPABASE_SERVICE_KEY not set')
    return false
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  let allExist = true

  for (const table of REQUIRED_TABLES) {
    try {
      const { error } = await supabase.from(table).select('count').limit(0)
      if (error && error.code === '42P01') {
        fail(`Table "${table}" does not exist`, 'Run schema.sql in Supabase SQL editor')
        allExist = false
      } else if (error) {
        fail(`Table "${table}" query failed`, error.message)
        allExist = false
      } else {
        pass(`Table "${table}" exists`)
      }
    } catch (err) {
      fail(`Table "${table}" check failed`, err.message)
      allExist = false
    }
  }

  return allExist
}

// ─── Check 4: At least 1 listing in the database ──────────────────────────────

async function checkListingsExist() {
  console.log('\n🏠  Listings Data')

  if (!SUPABASE_SERVICE_KEY) {
    warn('Listings check skipped', 'SUPABASE_SERVICE_KEY not set')
    return false
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    const { data, error } = await supabase
      .from('listings')
      .select('id, title, city, price, source')
      .eq('is_active', true)
      .limit(5)

    if (error) throw new Error(error.message)

    const count = data?.length ?? 0
    if (count === 0) {
      fail('No active listings in database', 'Run a scraper: node scripts/scrape-pararius.js')
      return false
    }

    pass(`${count} active listing(s) found`)
    data.slice(0, 3).forEach(l => console.log(`    • [${l.source}] ${l.title} — €${l.price} in ${l.city}`))

    // Also check total count
    const { count: total } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    if (total !== null) console.log(`  ℹ️   Total active listings: ${total}`)

    return true
  } catch (err) {
    fail('Listings check failed', err.message)
    return false
  }
}

// ─── Check 5: Resend email ────────────────────────────────────────────────────

async function checkResend() {
  console.log('\n📧  Email (Resend)')

  if (!RESEND_API_KEY) {
    warn('Resend API key not set', 'Email notifications will not work — set RESEND_API_KEY in Supabase Edge Function secrets')
    return null // not a hard failure
  }

  if (!TEST_EMAIL) {
    warn('TEST_EMAIL not set', 'Set TEST_EMAIL=your@email.com to receive a test email')
    return null
  }

  try {
    // Send a test email via Resend API directly
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Roof Pre-launch Check <hello@getroof.app>',
        to: [TEST_EMAIL],
        subject: '✅ Roof pre-launch email test',
        html: `<p>This is an automated pre-launch check email from Roof.</p><p>If you received this, Resend is configured correctly.</p><p style="color:#999;font-size:12px;">Sent at ${new Date().toISOString()}</p>`,
      }),
    })

    const body = await res.json()

    if (res.ok && body.id) {
      pass(`Resend email sent successfully`, `id: ${body.id} → ${TEST_EMAIL}`)
      return true
    } else {
      fail('Resend email failed', body.message || body.name || JSON.stringify(body))
      return false
    }
  } catch (err) {
    fail('Resend API request failed', err.message)
    return false
  }
}

// ─── Check 6: Scraper can reach Pararius ─────────────────────────────────────

async function checkParariusAccess() {
  console.log('\n🕷️   Scraper Access — Pararius')

  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      locale: 'en-US',
    })
    const page = await context.newPage()

    await page.goto('https://www.pararius.com/apartments/amsterdam/0-1500', {
      waitUntil: 'domcontentloaded',
      timeout: 20_000,
    })

    // Check for bot-blocking indicators
    const title = await page.title()
    const hasListings = await page.locator('section.listing-search-item').count()
    const isBlocked = title.toLowerCase().includes('403') ||
                      title.toLowerCase().includes('blocked') ||
                      title.toLowerCase().includes('captcha') ||
                      title.toLowerCase().includes('cloudflare')

    if (isBlocked) {
      fail('Pararius access blocked', `Page title: "${title}"`)
      return false
    }

    if (hasListings > 0) {
      pass(`Pararius is accessible`, `Found ${hasListings} listing section(s) on search page`)
    } else {
      warn('Pararius page loaded but no listings found', 'May be bot-detected or no results for this search')
    }

    return true
  } catch (err) {
    fail('Pararius access failed', err.message)
    return false
  } finally {
    await browser?.close()
  }
}

// ─── Check 7: Scraper can reach Kamernet ─────────────────────────────────────

async function checkKamernetAccess() {
  console.log('\n🕷️   Scraper Access — Kamernet')

  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      locale: 'en-US',
    })
    const page = await context.newPage()

    await page.goto('https://kamernet.nl/en/for-rent/rooms-amsterdam', {
      waitUntil: 'domcontentloaded',
      timeout: 20_000,
    })

    const title = await page.title()
    const isBlocked = title.toLowerCase().includes('403') ||
                      title.toLowerCase().includes('blocked') ||
                      title.toLowerCase().includes('captcha') ||
                      title.toLowerCase().includes('cloudflare')

    if (isBlocked) {
      fail('Kamernet access blocked', `Page title: "${title}"`)
      return false
    }

    // Kamernet renders listings in React — just check the page loaded
    const bodyText = await page.locator('body').innerText().catch(() => '')
    const hasContent = bodyText.length > 500

    if (hasContent) {
      pass('Kamernet is accessible', `Page loaded: "${title.slice(0, 50)}"`)
    } else {
      warn('Kamernet page may be empty', `Body text too short (${bodyText.length} chars)`)
    }

    return true
  } catch (err) {
    fail('Kamernet access failed', err.message)
    return false
  } finally {
    await browser?.close()
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const divider = '━'.repeat(55)
  console.log(divider)
  console.log('🚀  Roof — Pre-Launch Checklist')
  console.log(`    ${new Date().toLocaleString('en-NL', { timeZone: 'Europe/Amsterdam' })} (Amsterdam time)`)
  console.log(divider)

  await checkEnvVars()
  await checkSupabaseConnection()
  await checkTables()
  await checkListingsExist()
  await checkResend()
  await checkParariusAccess()
  await checkKamernetAccess()

  // ─── Final summary ────────────────────────────────────────────────────────

  const passed = checks.filter(c => c.pass === true)
  const failed = checks.filter(c => c.pass === false)
  const warnings = checks.filter(c => c.pass === null)

  console.log('\n' + divider)
  console.log('📊  RESULTS')
  console.log(divider)
  console.log(`✅  ${passed.length} check${passed.length !== 1 ? 's' : ''} passed`)
  if (warnings.length > 0) console.log(`⚠️   ${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`)
  if (failed.length > 0) {
    console.log(`❌  ${failed.length} check${failed.length !== 1 ? 's' : ''} failed`)
    console.log('\nFailed checks:')
    failed.forEach(c => console.log(`  ❌ ${c.name}: ${c.detail}`))
  }

  if (failed.length === 0) {
    console.log('\n🎉  All critical checks passed — ready for App Store launch!')
  } else {
    console.log('\n🛑  Fix the failing checks above before submitting to the App Store.')
  }

  console.log(divider)
  process.exit(failed.length > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message)
  process.exit(1)
})
