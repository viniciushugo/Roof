/**
 * daily-digest — Supabase Edge Function
 *
 * Sends a daily email digest to users with listings that match their alerts.
 * Intended to run on a schedule (e.g. every day at 18:00 Amsterdam time).
 *
 * Setup:
 *   1. Deploy: supabase functions deploy daily-digest
 *   2. Schedule via pg_cron or a cron job hitting:
 *      POST https://<project>.supabase.co/functions/v1/daily-digest
 *      Authorization: Bearer <service_role_key>
 *
 * Required env vars:
 *   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected by Supabase)
 *   - RESEND_API_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL = 'Roof <hello@getroof.app>'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Roof wordmark SVG (inline for email clients)
const ROOF_LOGO_SVG = `<svg width="96" height="49" viewBox="0 0 272 140" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path fill-rule="evenodd" clip-rule="evenodd" d="M238.732 5.78631C246.92 0.0211911 255.457 -1.72664 262.779 1.86754C268.547 4.69873 272.616 10.7812 271.923 18.2048C271.249 25.42 266.26 32.3886 257.485 38.3337L250.282 27.7463C257.36 22.9511 258.974 18.9567 259.155 17.0178C259.317 15.2872 258.492 14.0243 257.119 13.3504C255.51 12.5607 252.073 12.0541 246.126 16.2422C240.132 20.4626 232.545 28.9062 223.982 43.7479C221.253 48.4798 219.049 55.7921 218.575 63.4426C218.097 71.1492 219.43 78.2005 222.658 82.9972C226.207 88.2714 229.258 88.8527 230.384 88.7623C231.377 88.6825 233.024 87.9166 233.83 84.911C234.445 82.6148 233.965 80.064 231.836 74.9965C229.857 70.2872 226.563 63.66 224.346 55.3731L235.118 49.2416C241.616 55.8528 253.16 54.9291 258.527 46.8245L269.225 53.8802C262.965 63.3336 252.162 67.5281 241.982 66.1695C242.551 67.4637 243.116 68.7471 243.662 70.0486C245.852 75.26 248.045 81.4021 246.218 88.218C244.325 95.2787 238.936 100.914 231.413 101.518C224.023 102.111 217.078 97.6594 212.012 90.1318C206.625 82.1266 205.204 71.8913 205.776 62.653C206.088 57.613 207.01 52.574 208.406 47.9479C207.638 47.4157 206.92 47.028 206.256 46.7482C205.468 46.4159 204.681 46.2038 203.88 46.1009C204.641 49.4007 205.124 53.1901 205.172 57.5336C205.39 76.9257 191.254 96.059 171.798 96.0396C168.662 96.0365 162.662 96.1503 157.222 93.2349C151.202 90.0088 147.073 83.8766 145.736 74.2278C143.888 89.8427 133.319 104.098 117.562 106.149C113.64 106.659 107.411 106.833 101.218 104.1C99.2888 103.249 97.4312 102.145 95.6938 100.758C92.1792 109.664 85.4213 116.273 75.9296 116.56C67.3479 116.819 59.1713 111.695 52.2429 102.426C53.058 104.721 53.7225 107.064 54.223 109.352C55.0553 113.155 55.505 117.109 55.3655 120.809C55.2295 124.415 54.5147 128.321 52.54 131.591C49.2182 137.093 43.4059 141.08 36.3571 139.739C29.8378 138.499 24.7219 133.087 21.2051 125.886C19.1762 121.731 17.8325 115.754 17.0194 109.353C16.5293 105.495 16.208 101.281 16.0789 96.8917C15.8389 97.2873 15.6029 97.6971 15.3725 98.1186C14.3689 99.9549 13.5823 101.794 13.0433 103.195C12.7767 103.888 12.5776 104.455 12.4489 104.837C12.3847 105.027 12.3385 105.17 12.3104 105.259C12.2964 105.303 12.2869 105.333 12.2821 105.349L12.2808 105.353C12.281 105.352 12.2507 105.341 6.14023 103.512C-0.00100955 101.673 -0.000453011 101.672 8.00995e-06 101.67C0.000187993 101.669 0.000570286 101.668 0.000915468 101.667C0.00162904 101.664 0.00240691 101.662 0.00327486 101.659C0.00502458 101.653 0.0070696 101.646 0.00944557 101.638C0.0142074 101.623 0.0203236 101.603 0.0275947 101.58C0.0421641 101.532 0.0617783 101.469 0.086398 101.392C0.135633 101.237 0.205004 101.023 0.294387 100.757C0.472868 100.228 0.732775 99.4896 1.07226 98.6074C1.74539 96.8583 2.76032 94.4692 4.11442 91.9915C5.44924 89.5492 7.23611 86.7928 9.52287 84.4689C11.3046 82.6583 13.6453 80.8548 16.5513 79.861C17.6674 66.9101 20.6573 53.5253 26.7343 44.5953C33.4433 34.7367 40.6899 28.8633 47.9223 26.3529C55.2523 23.8087 62.1696 24.8915 67.2869 28.228C71.3498 30.8771 75.7844 34.7809 78.32 41.4869C80.7898 48.0188 81.1542 56.4088 78.8995 67.5146C76.5063 79.4037 69.5224 87.9659 60.4157 91.7488C66.5628 101.435 72.3495 103.865 75.5412 103.768C78.8403 103.669 83.7654 100.418 85.3038 90.2159L86.2577 83.8888L90.1041 84.4662L98.2826 81.9609C100.276 88.4421 103.534 91.1301 106.404 92.3967C109.576 93.7966 113.135 93.8194 115.903 93.4591C126.1 92.1319 134.98 79.7685 132.929 65.44C132.645 63.4567 132.271 61.6716 131.835 60.065C128.973 62.0852 126.152 64.4511 123.192 66.9316C119.177 70.2956 114.506 74.2416 109.705 76.3914C107.175 77.5243 104.276 78.3259 101.119 78.1732C97.8819 78.0166 94.837 76.8773 92.0638 74.8425C89.2482 72.7765 86.9587 69.5362 85.4815 66.2653C83.9906 62.964 82.9343 58.7628 83.5549 54.5362C85.7471 39.6083 97.5697 34.3639 101.59 32.8988C109.036 30.185 115.428 29.9682 120.832 31.2754C126.177 32.5686 130.048 35.2303 132.669 37.456C134.234 38.7849 135.985 40.5387 137.698 42.8459C139.285 42.3739 140.931 42.0111 142.635 41.7886C144.769 34.6031 149.555 29.7246 154 26.6302C158.454 23.5297 163.008 21.8982 165.528 21.3373C173.265 19.6151 179.631 20.2314 184.819 22.2304C189.949 24.2077 193.439 27.3503 195.747 29.8979C196.672 30.9191 197.655 32.1412 198.624 33.5935C198.672 33.5851 198.721 33.5763 198.769 33.5682C202.788 32.8896 207.017 33.1774 211.245 34.9597C212.044 35.2962 212.828 35.6799 213.598 36.1103C222.352 21.1928 230.81 11.3645 238.732 5.78631ZM28.8381 92.4733C28.8367 97.9455 29.1608 103.177 29.741 107.744C30.5021 113.735 31.638 118.038 32.7326 120.28C35.4629 125.87 37.9955 127.023 38.7585 127.168C38.992 127.213 40.0958 127.406 41.556 124.987C41.9722 124.298 42.4572 122.818 42.5511 120.328C42.6414 117.934 42.351 115.08 41.6948 112.081C40.3402 105.89 37.7103 100.294 35.1517 97.495C32.5605 94.6606 30.511 93.2251 28.8381 92.4733ZM60.273 38.9409C58.6318 37.8709 55.8835 37.1384 52.1351 38.4394C48.2891 39.7744 43.044 43.4071 37.3428 51.7847C33.2333 57.8235 30.6138 67.9826 29.4828 79.2958C30.2805 79.4636 31.0863 79.6783 31.8997 79.947C36.4476 81.4496 40.5467 84.409 44.6252 88.8704C44.861 89.1284 45.0933 89.3944 45.3225 89.6671L50.3977 81.0873C57.3119 80.6901 64.1694 75.7152 66.3274 64.9944L66.3298 64.9836C68.3122 55.2248 67.6386 49.4863 66.3221 46.0046C65.0706 42.6948 62.9686 40.6985 60.273 38.9409ZM191.664 50.3156C189.978 51.4004 188.2 52.6635 186.311 54.0747C181.211 57.8844 174.903 63.1371 168.97 65.8391C165.832 67.2684 162.152 68.3229 158.206 67.8892C154.086 67.4363 150.45 65.4487 147.394 62.1805C146.366 61.0809 145.423 59.7679 144.616 58.3013C145.013 59.9652 145.353 61.7392 145.624 63.6303C146.125 67.1352 146.151 70.6938 145.741 74.1849L158.435 72.4453C159.35 79.0977 161.705 81.112 163.289 81.961C165.461 83.1253 168.199 83.2392 171.811 83.2428C182.093 83.253 192.512 72.1499 192.35 57.6769C192.318 54.8764 192.062 52.4372 191.664 50.3156ZM117.811 43.712C115.131 43.0636 111.325 42.9743 105.989 44.919L105.989 44.9192C103.218 45.9289 97.3726 48.6984 96.2428 56.3917C96.0856 57.4626 96.3284 59.1387 97.1724 61.0076C98.0302 62.9068 99.1114 64.1298 99.6603 64.5326C100.596 65.219 101.251 65.3676 101.74 65.3912C102.311 65.4189 103.167 65.2931 104.456 64.7161C107.292 63.4461 110.516 60.8426 114.946 57.1312C118.122 54.4699 121.805 51.3491 125.866 48.6336C125.312 48.0462 124.799 47.5763 124.358 47.2017C122.651 45.7522 120.55 44.3747 117.811 43.712ZM180.199 34.168C177.666 33.1919 173.981 32.6114 168.578 33.7707L168.32 33.8272C167.311 34.0516 164.324 35.0466 161.337 37.1256C158.403 39.168 155.922 41.93 154.886 45.5782C154.528 46.8375 154.547 48.3722 154.973 49.9462C155.407 51.5496 156.153 52.7905 156.771 53.4509C158.054 54.8236 158.978 55.0999 159.61 55.1693C160.416 55.2579 161.679 55.0933 163.646 54.1977C167.922 52.2498 172.469 48.4297 178.626 43.8301C180.955 42.0903 183.534 40.2299 186.307 38.5613C186.282 38.5339 186.259 38.5063 186.234 38.4796C184.731 36.8204 182.828 35.1814 180.199 34.168Z" fill="#09090B"/>
</svg>`

interface Listing {
  id: string
  title: string
  city: string
  neighborhood: string | null
  price: number
  rooms: number | null
  size: number | null
  type: string | null
  source: string
  image_url: string | null
  url: string
}

function buildListingCard(listing: Listing, appUrl: string): string {
  const imageBlock = listing.image_url
    ? `<img src="${listing.image_url}" alt="" width="200" height="128" style="display:block;width:200px;height:128px;object-fit:cover;border-radius:12px;" />`
    : `<div style="width:200px;height:128px;background-color:#e4e4e7;border-radius:12px;display:inline-block;"></div>`

  const bedroomsLine = listing.rooms ? `<p style="margin:0 0 4px;font-size:16px;color:#09090b;">Bedrooms: ${listing.rooms}</p>` : ''
  const sizeLine = listing.size ? `<p style="margin:0 0 12px;font-size:16px;color:#09090b;">Surface: ${listing.size}m²</p>` : `<p style="margin:0 0 12px;"></p>`

  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f1f5f9;border-radius:16px;margin-bottom:16px;">
      <tr>
        <td style="padding:16px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="width:200px;vertical-align:top;">
                ${imageBlock}
              </td>
              <td style="padding-left:20px;vertical-align:top;">
                <p style="margin:0 0 8px;font-size:24px;font-weight:700;color:#09090b;line-height:1.2;">${listing.title}</p>
                <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#09090b;">€${listing.price.toLocaleString()}</p>
                ${bedroomsLine}
                ${sizeLine}
                <a href="${appUrl}" style="display:block;text-align:center;background-color:#18181b;color:#fafafa;font-size:14px;font-weight:500;text-decoration:none;padding:10px 16px;border-radius:6px;">View Match</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`
}

function buildDigestHtml(firstName: string, listings: Listing[], appUrl: string): string {
  const listingCards = listings.slice(0, 5).map((l) => buildListingCard(l, appUrl)).join('')
  const listingCount = listings.length

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your daily hunt. Fresh listings, zero scrolling.</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#ffffff;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:580px;background-color:#ffffff;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding:0 0 24px;">
              ${ROOF_LOGO_SVG}
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td align="center" style="padding:0 32px 24px;">
              <h1 style="margin:0;font-size:30px;font-weight:800;line-height:1.2;color:#09090b;letter-spacing:-0.5px;text-align:center;">Your daily hunt. Fresh listings, zero scrolling. 🔍</h1>
            </td>
          </tr>


          <!-- Intro text -->
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="margin:0;font-size:16px;line-height:1.7;color:#09090b;">Hey ${firstName}, we've been busy. Here's what dropped today that matches your search — act fast, these won't stick around.</p>
            </td>
          </tr>

          <!-- Listing cards -->
          <tr>
            <td style="padding:0 32px 8px;">
              ${listingCards}
              ${listingCount > 5 ? `<p style="margin:8px 0 0;font-size:14px;color:#71717a;text-align:center;">+ ${listingCount - 5} more matching listings in the app</p>` : ''}
            </td>
          </tr>

          <!-- Tweak text -->
          <tr>
            <td style="padding:16px 32px 24px;">
              <p style="margin:0;font-size:16px;line-height:1.7;color:#09090b;">Not quite right? Tweak your filters and tomorrow's digest will be even sharper.</p>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:0 32px 32px;">
              <a href="${appUrl}" style="display:inline-block;background-color:#18181b;color:#fafafa;font-size:14px;font-weight:500;text-decoration:none;padding:10px 20px;border-radius:6px;">Update my search</a>
            </td>
          </tr>

          <!-- Sign-off -->
          <tr>
            <td style="padding:0 32px 32px;">
              <p style="margin:0;font-size:16px;line-height:1.7;color:#09090b;">Good luck out there — though with Roof, you won't need it.</p>
              <p style="margin:8px 0 0;font-size:16px;font-weight:700;color:#09090b;">The Roof team</p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 32px 24px;">
              <hr style="border:none;border-top:1px solid #e4e4e7;margin:0;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:0 32px 40px;">
              <p style="margin:0 0 8px;font-size:12px;color:#a1a1aa;">
                <a href="https://instagram.com/getroof" style="color:#a1a1aa;text-decoration:none;margin-right:12px;">Instagram</a>
                <a href="https://facebook.com/getroof" style="color:#a1a1aa;text-decoration:none;margin-right:12px;">Facebook</a>
                <a href="https://x.com/getroof" style="color:#a1a1aa;text-decoration:none;margin-right:12px;">X</a>
                <a href="https://youtube.com/getroof" style="color:#a1a1aa;text-decoration:none;">YouTube</a>
              </p>
              <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;">You're receiving this daily digest because you have active alerts on Roof. <a href="${appUrl}/alerts" style="color:#71717a;">Manage alerts</a> · <a href="mailto:hello@getroof.app" style="color:#71717a;">hello@getroof.app</a></p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const appUrl = 'https://getroof.app/app/rooms'

    const supabase = createClient(supabaseUrl, serviceKey)

    if (!RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not set — skipping digest')
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get listings from the past 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: recentListings, error: listingsError } = await supabase
      .from('listings')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })

    if (listingsError) {
      console.error('Error fetching listings:', listingsError)
      return new Response(JSON.stringify({ error: listingsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!recentListings || recentListings.length === 0) {
      console.log('No new listings in the past 24h — skipping digest')
      return new Response(JSON.stringify({ sent: 0, reason: 'no_new_listings' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get all alerts with profile names
    const { data: alerts, error: alertsError } = await supabase
      .from('alerts')
      .select('*, profiles(name)')

    if (alertsError || !alerts?.length) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no_alerts' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch auth user emails via admin API (emails live in auth.users, not profiles)
    const uniqueUserIds = [...new Set(alerts.map((a: any) => a.user_id))]
    const userEmailMap = new Map<string, string>()
    await Promise.all(
      uniqueUserIds.map(async (uid) => {
        const { data } = await supabase.auth.admin.getUserById(uid)
        if (data?.user?.email) userEmailMap.set(uid, data.user.email)
      })
    )

    // Group alerts by user
    const userMap = new Map<string, { name: string; email: string; alerts: any[] }>()
    for (const alert of alerts) {
      const email = userEmailMap.get(alert.user_id)
      if (!email) continue
      const profile = (alert as any).profiles
      if (!userMap.has(alert.user_id)) {
        userMap.set(alert.user_id, {
          name: profile?.name || 'there',
          email,
          alerts: [],
        })
      }
      userMap.get(alert.user_id)!.alerts.push(alert)
    }

    let sentCount = 0
    const errors: string[] = []

    for (const [, user] of userMap) {
      // Filter listings that match any of this user's alerts
      const matchingListings = recentListings.filter((listing: any) =>
        user.alerts.some((alert: any) => {
          if (alert.cities?.length > 0 && !alert.cities.includes(listing.city)) return false
          if (alert.budget_max > 0 && listing.price > alert.budget_max) return false
          if (alert.budget_min > 0 && listing.price < alert.budget_min) return false
          const ht = (alert.housing_type ?? '').toLowerCase()
          if (ht && ht !== 'all') {
            const typeMap: Record<string, string[]> = {
              room: ['Private room', 'Room'],
              studio: ['Studio'],
              apartment: ['Apartment'],
            }
            const allowed = typeMap[ht] || []
            if (!listing.type || !allowed.includes(listing.type)) return false
          }
          return true
        })
      )

      if (matchingListings.length === 0) continue

      const firstName = (user.name || 'there').split(' ')[0]
      const html = buildDigestHtml(firstName, matchingListings, appUrl)

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: user.email,
          subject: `${matchingListings.length} new listing${matchingListings.length > 1 ? 's' : ''} matching your search today`,
          html,
        }),
      })

      if (res.ok) {
        sentCount++
        console.log(`Digest sent to ${user.email} (${matchingListings.length} listings)`)
      } else {
        const err = await res.json()
        errors.push(`${user.email}: ${JSON.stringify(err)}`)
      }
    }

    return new Response(
      JSON.stringify({ sent: sentCount, errors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Digest error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
