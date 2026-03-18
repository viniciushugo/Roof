/**
 * End-to-end alert flow test
 *
 * Simulates the full Roof pipeline: scrape → match → notify
 *
 * Steps:
 *   1. Create a test user in Supabase (via admin API)
 *   2. Create an alert for that user: Amsterdam, €800–1200, room
 *   3. Insert a fake listing that matches the alert
 *   4. Invoke the notify-new-listings function manually
 *   5. Verify the function matched the alert and triggered a notification
 *   6. Clean up: delete the user, listing, alert
 *
 * Usage:
 *   node scripts/test-alert-flow.js
 *
 * Required env vars (scripts/.env or ../.env.test):
 *   SUPABASE_URL          — Supabase project URL
 *   SUPABASE_SERVICE_KEY  — service_role key (required — bypasses RLS + admin ops)
 *   SUPABASE_ANON_KEY     — anon key (used to get the function URL)
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') })
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.test') })

const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wzsdnhzsosonlcgubmxe.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌  SUPABASE_SERVICE_KEY is required for this test.')
  console.error('   Set it in scripts/.env or ../.env.test')
  process.exit(1)
}

// Service role client — bypasses RLS, can use admin.auth
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TEST_EMAIL = `test-alert-flow-${Date.now()}@getroof.app`
const TEST_PASSWORD = `TestPass${Date.now()}!`
const FAKE_LISTING_URL = `https://test.roof.nl/listing/${Date.now()}`

// Track created resources for cleanup
const createdResources = { userId: null, listingId: null, alertId: null }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(emoji, msg) { console.log(`${emoji}  ${msg}`) }
function step(n, msg) { console.log(`\n${'─'.repeat(55)}\nStep ${n}: ${msg}\n${'─'.repeat(55)}`) }

// ─── Step 1: Create test user ─────────────────────────────────────────────────

async function createTestUser() {
  step(1, 'Creating test user')

  // Use admin auth to create a confirmed user (no email verification needed)
  const { data, error } = await supabase.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { name: 'Alert Flow Test User' },
  })

  if (error) throw new Error(`Failed to create test user: ${error.message}`)

  createdResources.userId = data.user.id
  log('✅', `Created test user: ${TEST_EMAIL} (id: ${data.user.id})`)
  return data.user
}

// ─── Step 2: Create test alert ────────────────────────────────────────────────

async function createTestAlert(userId) {
  step(2, 'Creating search alert: Amsterdam, €800–1200, room')

  const { data, error } = await supabase
    .from('alerts')
    .insert({
      user_id: userId,
      name: 'Test Alert — Amsterdam rooms',
      cities: ['Amsterdam'],
      housing_type: 'room',
      budget_min: 800,
      budget_max: 1200,
      filters: {},
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create alert: ${error.message}`)

  createdResources.alertId = data.id
  log('✅', `Created alert: "${data.name}" (id: ${data.id})`)
  log('   ', `  Cities: ${data.cities.join(', ')}`)
  log('   ', `  Budget: €${data.budget_min} – €${data.budget_max}`)
  log('   ', `  Type: ${data.housing_type}`)
  return data
}

// ─── Step 3: Insert fake listing ──────────────────────────────────────────────

async function insertFakeListing() {
  step(3, 'Inserting fake listing that matches the alert')

  const externalId = crypto.createHash('sha256').update(`test:${FAKE_LISTING_URL}`).digest('hex').slice(0, 32)

  const { data, error } = await supabase
    .from('listings')
    .insert({
      external_id: externalId,
      title: 'Test room in Amsterdam',
      neighborhood: 'De Pijp',
      city: 'Amsterdam',
      price: 950,
      type: 'Private room',
      size: 18,
      rooms: 1,
      furnished: 'furnished',
      source: 'test',
      url: FAKE_LISTING_URL,
      image_url: null,
      is_active: true,
      is_new: true,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to insert listing: ${error.message}`)

  createdResources.listingId = data.id
  log('✅', `Inserted listing: "${data.title}" (id: ${data.id})`)
  log('   ', `  City: ${data.city} | Price: €${data.price}/mo | Type: ${data.type}`)
  log('   ', `  URL: ${data.url}`)
  return data
}

// ─── Step 4: Invoke matching engine ───────────────────────────────────────────

async function invokeMatchingEngine(listing) {
  step(4, 'Invoking notify-new-listings function')

  // Simulate the database webhook payload
  const payload = {
    type: 'INSERT',
    table: 'listings',
    record: {
      id: listing.id,
      title: listing.title,
      city: listing.city,
      price: listing.price,
      type: listing.type,
      source: listing.source,
      neighborhood: listing.neighborhood,
      image_url: listing.image_url,
      url: listing.url,
    },
  }

  log('📡', `Calling notify-new-listings with listing: ${listing.title}`)

  const { data, error } = await supabase.functions.invoke('notify-new-listings', {
    body: payload,
    headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  })

  if (error) {
    log('⚠️ ', `Function invocation error: ${error.message}`)
    return { matched: 0, functionError: error.message }
  }

  log('✅', `Function responded: ${JSON.stringify(data)}`)
  return data
}

// ─── Step 5: Verify results ───────────────────────────────────────────────────

async function verifyResults(functionResult, testUserId) {
  step(5, 'Verifying notification was triggered')

  // Check 1: Function matched at least 1 alert
  if (functionResult.functionError) {
    log('❌', `Function returned an error — check Supabase Edge Function logs`)
    return false
  }

  const matched = functionResult.matched ?? 0
  if (matched > 0) {
    log('✅', `Function matched ${matched} alert(s) — notification pipeline triggered`)
    log('   ', `  Alert IDs: ${(functionResult.alert_ids || []).join(', ')}`)
  } else {
    log('❌', `Function returned matched=0 — no alerts were matched`)
    log('   ', `  This may mean the alert criteria didn't match the listing.`)
    log('   ', `  Check: city='Amsterdam', price=950 (within 800–1200), type='Private room'`)
  }

  // Check 2: Push notifications (APNs) — will be 0 since test user has no device token
  const pushSent = functionResult.push_sent ?? 0
  if (pushSent > 0) {
    log('✅', `${pushSent} push notification(s) dispatched`)
  } else {
    log('ℹ️ ', `Push notifications: 0 (test user has no registered device token — expected)`)
  }

  // Check 3: Verify the alert still exists in the DB (it should not be deleted)
  const { data: alertCheck } = await supabase
    .from('alerts')
    .select('id')
    .eq('id', createdResources.alertId)
    .single()

  if (alertCheck) {
    log('✅', `Alert is still active in the database`)
  }

  return matched > 0
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

async function cleanup() {
  step('6 (cleanup)', 'Removing all test data')

  const results = { user: false, listing: false, alert: false }

  // Delete the test listing
  if (createdResources.listingId) {
    const { error } = await supabase.from('listings').delete().eq('id', createdResources.listingId)
    if (error) {
      log('❌', `Failed to delete listing: ${error.message}`)
    } else {
      log('✅', `Deleted fake listing (id: ${createdResources.listingId})`)
      results.listing = true
    }
  }

  // Delete the alert (will also be cascade-deleted when user is deleted, but be explicit)
  if (createdResources.alertId) {
    const { error } = await supabase.from('alerts').delete().eq('id', createdResources.alertId)
    if (error) {
      log('⚠️ ', `Alert delete warning: ${error.message} (may already be deleted via cascade)`)
    } else {
      log('✅', `Deleted test alert (id: ${createdResources.alertId})`)
      results.alert = true
    }
  }

  // Delete the test user (cascades to profiles, alerts, saved_listings)
  if (createdResources.userId) {
    const { error } = await supabase.auth.admin.deleteUser(createdResources.userId)
    if (error) {
      log('❌', `Failed to delete test user: ${error.message}`)
    } else {
      log('✅', `Deleted test user: ${TEST_EMAIL} (id: ${createdResources.userId})`)
      results.user = true
    }
  }

  return results
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const divider = '━'.repeat(55)
  console.log(divider)
  console.log('🧪  Roof — End-to-End Alert Flow Test')
  console.log(divider)
  console.log(`Supabase URL : ${SUPABASE_URL}`)
  console.log(`Test email   : ${TEST_EMAIL}`)
  console.log(divider)

  let passed = false

  try {
    // Steps 1–3: setup
    const user = await createTestUser()
    await createTestAlert(user.id)
    const listing = await insertFakeListing()

    // Step 4: trigger
    const functionResult = await invokeMatchingEngine(listing)

    // Step 5: verify
    passed = await verifyResults(functionResult, user.id)

  } catch (err) {
    console.error('\n❌ Test failed with error:', err.message)
    passed = false
  } finally {
    // Always clean up, even if the test fails
    try {
      await cleanup()
    } catch (cleanupErr) {
      console.error('⚠️  Cleanup error:', cleanupErr.message)
    }
  }

  // ─── Final result ───────────────────────────────────────────────────────
  const divider2 = '━'.repeat(55)
  console.log('\n' + divider2)
  console.log(passed ? '✅  ALERT FLOW TEST PASSED' : '❌  ALERT FLOW TEST FAILED')
  console.log(divider2)

  if (!passed) {
    console.log('\nTroubleshooting tips:')
    console.log('  1. Check that notify-new-listings is deployed:')
    console.log('     supabase functions deploy notify-new-listings')
    console.log('  2. Check Supabase Edge Function logs in the Dashboard')
    console.log('  3. Verify SUPABASE_SERVICE_KEY has service_role permissions')
  }

  process.exit(passed ? 0 : 1)
}

main().catch(err => {
  console.error('❌ Fatal:', err.message)
  process.exit(1)
})
