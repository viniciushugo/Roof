require('dotenv').config({ path: require('path').join(__dirname, '.env') })
const { chromium } = require('playwright')

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    viewport: { width: 1280, height: 800 },
  })

  await page.goto('https://www.pararius.com/apartments/amsterdam/0-1500', { waitUntil: 'domcontentloaded', timeout: 30000 })
  const consent = page.locator('button:has-text("Agree"), button:has-text("Accept"), button:has-text("Akkoord")')
  if (await consent.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await consent.first().click()
    await page.waitForTimeout(500)
  }

  const results = await page.evaluate(() => {
    const items = document.querySelectorAll('li.search-list__item--listing, section.listing-search-item')
    return Array.from(items).map(item => {
      const titleEl = item.querySelector('a.listing-search-item__link--title, h2.listing-search-item__title a')
      const title = titleEl?.textContent?.trim() || ''
      const href = titleEl?.getAttribute('href') || ''

      let imageUrl = null
      const srcset = item.querySelector('source[srcset]')?.getAttribute('srcset')
      if (srcset) {
        const parts = srcset.split(',')
        imageUrl = parts[parts.length - 1].trim().split(' ')[0] || null
      }
      if (!imageUrl) {
        const src = item.querySelector('img.picture__image, img[class*="picture"]')?.getAttribute('src')
        if (src && src.startsWith('http')) imageUrl = src
      }

      return { tag: item.tagName, class: item.className.substring(0, 60), title, href: href.substring(0, 60), hasImage: !!imageUrl, imageUrl: imageUrl ? imageUrl.substring(0, 80) : null }
    })
  })

  console.log(`Total items found: ${results.length}`)
  const withImg = results.filter(r => r.hasImage)
  const noImg = results.filter(r => !r.hasImage)
  console.log(`With image: ${withImg.length}, No image: ${noImg.length}`)
  console.log('\nFirst 5 items:')
  results.slice(0, 5).forEach((r, i) => console.log(`  [${i}] ${r.tag} | ${r.class} | title: "${r.title.substring(0,40)}" | img: ${r.hasImage}`))
  console.log('\nItems WITHOUT images:')
  noImg.forEach((r, i) => console.log(`  [${i}] ${r.tag} | ${r.class} | title: "${r.title.substring(0,40)}"`))

  await browser.close()
}
main().catch(e => console.error(e.message))
