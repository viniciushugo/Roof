require('dotenv').config({ path: require('path').join(__dirname, '.env') })
const { chromium } = require('playwright')

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    viewport: { width: 1280, height: 800 },
  })

  await page.goto('https://www.pararius.com/apartments/amsterdam/0-1500', { waitUntil: 'domcontentloaded', timeout: 30000 })

  // Accept cookies
  const consent = page.locator('button:has-text("Agree"), button:has-text("Accept"), button:has-text("Akkoord")')
  if (await consent.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await consent.first().click()
    await page.waitForTimeout(1000)
  }

  await page.waitForTimeout(2000)

  // Debug: check first 3 listing items and their image structure
  const debug = await page.evaluate(() => {
    const items = document.querySelectorAll('li.search-list__item--listing, section.listing-search-item')
    return Array.from(items).slice(0, 3).map((item, i) => {
      const imgs = item.querySelectorAll('img')
      const sources = item.querySelectorAll('source')
      const pictures = item.querySelectorAll('picture')
      return {
        index: i,
        itemTag: item.tagName,
        itemClass: item.className,
        imgCount: imgs.length,
        imgs: Array.from(imgs).map(img => ({ class: img.className, src: (img.src || '').substring(0, 120), alt: img.alt })),
        sourceCount: sources.length,
        sources: Array.from(sources).map(s => ({ srcset: (s.getAttribute('srcset') || '').substring(0, 200), type: s.type })),
        pictureCount: pictures.length,
        // Also check for lazy-loaded data attributes
        lazyImgs: Array.from(imgs).map(img => ({
          dataSrc: img.getAttribute('data-src'),
          dataSrcset: img.getAttribute('data-srcset'),
          loading: img.getAttribute('loading'),
        })),
      }
    })
  })

  console.log(JSON.stringify(debug, null, 2))

  // Also screenshot
  await page.screenshot({ path: '/tmp/pararius-debug.png' })
  console.log('\nScreenshot saved to /tmp/pararius-debug.png')

  await browser.close()
}

main().catch(e => console.error(e.message))
