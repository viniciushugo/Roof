/**
 * notify-new-listings — Supabase Edge Function
 *
 * Triggered via Database Webhook when new listings are inserted.
 * Checks if any user alerts match the new listing and sends:
 *   1. Email notifications via Resend
 *   2. Push notifications via APNs (iOS)
 *
 * Setup:
 *   1. Deploy: supabase functions deploy notify-new-listings
 *   2. In Supabase Dashboard → Database → Webhooks:
 *      - Table: listings
 *      - Events: INSERT
 *      - URL: https://<project>.supabase.co/functions/v1/notify-new-listings
 *      - HTTP Headers: Authorization: Bearer <service_role_key>
 *
 * Required env vars:
 *   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected by Supabase)
 *   - RESEND_API_KEY (for email)
 *   - APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY (for iOS push)
 *   - APNS_BUNDLE_ID (default: com.hugovinicius.roof)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WebhookPayload {
  type: 'INSERT'
  table: string
  record: {
    id: string
    title: string
    city: string
    price: number
    type: string | null
    source: string
    neighborhood: string | null
    image_url: string | null
    url: string
  }
}

interface ListingEmail {
  firstName: string
  title: string
  city: string
  neighborhood: string | null
  price: number
  type: string | null
  source: string
  imageUrl: string | null
}

function buildNotificationHtml(l: ListingEmail): string {
  const locationLine = l.neighborhood ? `${l.neighborhood}, ${l.city}` : l.city
  const typeLine = l.type ? ` · ${l.type}` : ''
  const imageBlock = l.imageUrl
    ? `<tr><td style="padding:0 40px 24px;"><img src="${l.imageUrl}" alt="" width="100%" style="border-radius:12px;max-height:220px;object-fit:cover;" /></td></tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f8f8f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f8f7;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:32px 40px 24px;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:#71717a;">New listing alert</p>
          <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;line-height:1.2;color:#09090b;">Hey ${l.firstName}, a new place just dropped</h1>
          <p style="margin:0;font-size:15px;color:#52525b;">A listing matching your alert was just posted on ${l.source}.</p>
        </td></tr>
        ${imageBlock}
        <tr><td style="padding:0 40px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;border-radius:12px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 4px;font-size:17px;font-weight:700;color:#09090b;">${l.title}</p>
              <p style="margin:0 0 12px;font-size:14px;color:#71717a;">${locationLine}${typeLine}</p>
              <p style="margin:0;font-size:22px;font-weight:700;color:#09090b;">€${l.price.toLocaleString()}<span style="font-size:14px;font-weight:400;color:#71717a;">/month</span></p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 40px 32px;">
          <a href="https://getroof.nl/app/rooms" style="display:inline-block;background-color:#09090b;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:100px;">View listing →</a>
        </td></tr>
        <tr><td style="padding:24px 40px;background-color:#fafafa;border-top:1px solid #f4f4f5;">
          <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;">You're receiving this because you have an active alert on Roof. <a href="https://getroof.nl/app/alerts" style="color:#52525b;">Manage alerts</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ─── APNs Push Notifications ─────────────────────────────────────────────────

/**
 * Generate a JWT for APNs authentication (Token-based auth).
 * Uses ES256 (P-256 ECDSA) signing with the Apple private key.
 */
async function generateApnsJwt(keyId: string, teamId: string, privateKeyPem: string): Promise<string> {
  // Base64url encode helper
  const b64url = (data: Uint8Array) =>
    btoa(String.fromCharCode(...data))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

  const encoder = new TextEncoder()

  const header = { alg: 'ES256', kid: keyId }
  const payload = { iss: teamId, iat: Math.floor(Date.now() / 1000) }

  const headerB64 = b64url(encoder.encode(JSON.stringify(header)))
  const payloadB64 = b64url(encoder.encode(JSON.stringify(payload)))
  const signingInput = `${headerB64}.${payloadB64}`

  // Import the private key
  const pemBody = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '')

  const keyData = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0))

  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    encoder.encode(signingInput),
  )

  const signatureB64 = b64url(new Uint8Array(signature))
  return `${signingInput}.${signatureB64}`
}

interface PushResult {
  token: string
  success: boolean
  error?: string
}

async function sendApnsPush(
  deviceTokens: string[],
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<PushResult[]> {
  const keyId = Deno.env.get('APNS_KEY_ID')
  const teamId = Deno.env.get('APNS_TEAM_ID')
  const privateKey = Deno.env.get('APNS_PRIVATE_KEY')
  const bundleId = Deno.env.get('APNS_BUNDLE_ID') ?? 'com.hugovinicius.roof'

  if (!keyId || !teamId || !privateKey) {
    console.log('[Push] APNs not configured — skipping push notifications')
    return []
  }

  const jwt = await generateApnsJwt(keyId, teamId, privateKey)
  const results: PushResult[] = []

  // Use sandbox for development builds, production for release
  const useSandbox = Deno.env.get('APNS_SANDBOX') !== 'false'
  const apnsHost = useSandbox
    ? 'https://api.sandbox.push.apple.com'
    : 'https://api.push.apple.com'
  console.log(`[Push] Using APNs ${useSandbox ? 'sandbox' : 'production'} endpoint`)

  for (const token of deviceTokens) {
    try {
      const res = await fetch(`${apnsHost}/3/device/${token}`, {
        method: 'POST',
        headers: {
          authorization: `bearer ${jwt}`,
          'apns-topic': bundleId,
          'apns-push-type': 'alert',
          'apns-priority': '10',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          aps: {
            alert: { title, body },
            sound: 'default',
            badge: 1,
            'mutable-content': 1,
          },
          ...data,
        }),
      })

      results.push({
        token,
        success: res.ok,
        error: res.ok ? undefined : `${res.status}: ${await res.text()}`,
      })

      // If token is invalid, we should clean it up
      if (res.status === 410 || res.status === 400) {
        console.log(`[Push] Removing invalid token: ${token.slice(0, 8)}...`)
        // Token cleanup will happen below
      }
    } catch (err) {
      results.push({ token, success: false, error: (err as Error).message })
    }
  }

  return results
}

// ─── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, serviceKey)

    const payload: WebhookPayload = await req.json()
    const listing = payload.record
    console.log(`[Payload] type=${payload.type} table=${payload.table} listing: ${listing?.title ?? 'none'} city=${listing?.city} price=${listing?.price}`)

    if (!listing) {
      return new Response(JSON.stringify({ error: 'No record in payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Find alerts that match this listing
    const { data: alerts, error: alertsError } = await supabase
      .from('alerts')
      .select('*, profiles!alerts_user_id_fkey(name)')

    console.log(`[Alerts] Query result: ${alerts?.length ?? 0} alerts, error: ${alertsError?.message ?? 'none'}`)

    if (alertsError || !alerts?.length) {
      return new Response(JSON.stringify({ matched: 0, alertsError: alertsError?.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const matched = alerts.filter((alert: any) => {
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

    console.log(`Listing "${listing.title}" in ${listing.city} matched ${matched.length} alert(s)`)

    // Collect unique user IDs from matched alerts
    const matchedUserIds = [...new Set(matched.map((a: any) => a.user_id as string))]

    // ─── Email notifications skipped (no email column in profiles) ────────────
    const emailResults: { alertId: string; success: boolean }[] = []

    // ─── Send push notifications via APNs ────────────────────────────────────
    let pushResults: PushResult[] = []

    if (matchedUserIds.length > 0) {
      // Fetch device tokens for all matched users
      const { data: tokens } = await supabase
        .from('push_tokens')
        .select('token, user_id')
        .in('user_id', matchedUserIds)
        .eq('platform', 'ios')

      console.log(`[Push] Found ${tokens?.length ?? 0} device token(s) for ${matchedUserIds.length} user(s)`)

      if (tokens && tokens.length > 0) {
        const deviceTokens = tokens.map((t: any) => t.token as string)
        console.log(`[Push] Tokens: ${deviceTokens.map(t => t.slice(0, 8) + '...').join(', ')}`)
        const neighborhood = listing.neighborhood ? ` in ${listing.neighborhood}` : ''
        const pushTitle = `New listing${neighborhood}`
        const pushBody = `€${listing.price}/mo · ${listing.source} — ${listing.title}`

        pushResults = await sendApnsPush(deviceTokens, pushTitle, pushBody, {
          listing_id: listing.id,
          url: listing.url ?? '',
        })
        console.log(`[Push] Results: ${JSON.stringify(pushResults)}`)

        // Clean up expired/unregistered tokens (410 = unregistered)
        const invalidTokens = pushResults
          .filter((r) => r.error?.startsWith('410') || r.error?.includes('BadDeviceToken'))
          .map((r) => r.token)

        if (invalidTokens.length > 0) {
          await supabase
            .from('push_tokens')
            .delete()
            .in('token', invalidTokens)
          console.log(`[Push] Cleaned up ${invalidTokens.length} invalid token(s)`)
        }
      }
    }

    return new Response(
      JSON.stringify({
        listing_id: listing.id,
        matched: matched.length,
        alert_ids: matched.map((a: any) => a.id),
        push_sent: pushResults.filter((r) => r.success).length,
        push_errors: pushResults.filter((r) => !r.success),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
