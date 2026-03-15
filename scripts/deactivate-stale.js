/**
 * deactivate-stale.js — marks listings as inactive if not seen in 3+ days
 *
 * Usage:
 *   node deactivate-stale.js
 *
 * Required env: SUPABASE_SERVICE_KEY
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') })
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wzsdnhzsosonlcgubmxe.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

let supabase = null
if (SUPABASE_SERVICE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
}

async function main() {
  console.log('━'.repeat(60))
  console.log('🧹  Deactivate Stale Listings')
  console.log('━'.repeat(60))

  if (!supabase) {
    console.log('\n⚠️  No SUPABASE_SERVICE_KEY — skipping')
    return
  }

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  console.log(`\nCutoff: ${threeDaysAgo}`)

  // Fetch stale active listings (need source for breakdown)
  const { data: stale, error: fetchError } = await supabase
    .from('listings')
    .select('id, source')
    .eq('is_active', true)
    .lt('last_seen_at', threeDaysAgo)

  if (fetchError) {
    console.error('\n❌ Error fetching stale listings:', fetchError.message)
    process.exit(1)
  }

  if (!stale || stale.length === 0) {
    console.log('\n✅ No stale listings found — nothing to deactivate')
    return
  }

  // Deactivate them
  const ids = stale.map((l) => l.id)
  const { error: updateError } = await supabase
    .from('listings')
    .update({ is_active: false })
    .in('id', ids)

  if (updateError) {
    console.error('\n❌ Error deactivating listings:', updateError.message)
    process.exit(1)
  }

  console.log(`\n✅ Deactivated ${stale.length} stale listing(s)`)

  // Breakdown by source
  const breakdown = {}
  for (const { source } of stale) {
    const key = source || 'Unknown'
    breakdown[key] = (breakdown[key] || 0) + 1
  }

  const summary = Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([source, count]) => `${source}: ${count}`)
    .join(', ')

  console.log(`   Breakdown: ${summary}`)
  console.log('━'.repeat(60))
}

main().catch((err) => { console.error('\n❌ Error:', err.message); process.exit(1) })
