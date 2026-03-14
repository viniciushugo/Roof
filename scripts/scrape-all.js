/**
 * scrape-all.js — runs all scrapers sequentially, then batch-uploads images
 *
 * Usage:
 *   node scrape-all.js
 *   node scrape-all.js --city Amsterdam --max 1500
 *
 * Required env: SUPABASE_SERVICE_KEY (set in .env or inline)
 *
 * Runs: Pararius → Kamernet → Huurwoningen → HousingAnywhere → DirectWonen → Rentola → Kamer.nl → Image Upload
 * Each scraper deduplicates by external_id so overlapping runs are safe.
 * Funda is excluded — their bot protection blocks all automated access.
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })
const { execSync } = require('child_process')

const dir = __dirname

// Forward CLI args to each scraper
const args = process.argv.slice(2).join(' ')

const scrapers = [
  { name: 'Pararius',     file: 'scrape-pararius.js',    extra: '' },
  { name: 'Kamernet',     file: 'scrape-kamernet.js',    extra: '--type room' },
  { name: 'Huurwoningen',    file: 'scrape-huurwoningen.js',    extra: '' },
  { name: 'HousingAnywhere', file: 'scrape-housinganywhere.js', extra: '' },
  { name: 'DirectWonen',     file: 'scrape-directwonen.js',     extra: '' },
  { name: 'Rentola',         file: 'scrape-rentola.js',        extra: '' },
  { name: 'Kamer.nl',        file: 'scrape-kamernl.js',        extra: '--type room' },
]

console.log('═'.repeat(60))
console.log('  Roof — Full Scrape Run')
console.log('═'.repeat(60))
console.log(`  Args: ${args || '(defaults)'}`)
console.log('═'.repeat(60))

const results = []

for (const { name, file, extra } of scrapers) {
  const cmd = `node ${path.join(dir, file)} ${args} ${extra}`.trim()
  console.log(`\n\n${'─'.repeat(60)}`)
  console.log(`  ▶ ${name}`)
  console.log('─'.repeat(60))
  try {
    execSync(cmd, { stdio: 'inherit', env: process.env })
    results.push({ name, ok: true })
  } catch (err) {
    console.error(`\n❌ ${name} scraper failed: ${err.message}`)
    results.push({ name, ok: false, err: err.message })
  }
}

// Batch-upload images to Supabase Storage
console.log(`\n\n${'─'.repeat(60)}`)
console.log('  ▶ Image Upload')
console.log('─'.repeat(60))
try {
  execSync(`node ${path.join(dir, 'fix-images.js')}`, { stdio: 'inherit', env: process.env })
  results.push({ name: 'Image Upload', ok: true })
} catch (err) {
  console.error(`\n❌ Image upload failed: ${err.message}`)
  results.push({ name: 'Image Upload', ok: false, err: err.message })
}

console.log('\n\n' + '═'.repeat(60))
console.log('  Scrape complete')
console.log('═'.repeat(60))
results.forEach(({ name, ok }) => {
  console.log(`  ${ok ? '✅' : '❌'} ${name}`)
})
console.log('═'.repeat(60) + '\n')
