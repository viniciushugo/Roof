const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL = 'Roof <hello@getroof.app>'
const TO_EMAIL = 'hugoviniciusdesign@gmail.com'

function buildEmailHtml(message: string, userEmail: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Feature Request from Roof</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#ffffff;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:580px;">
          <tr>
            <td style="padding:0 0 24px;">
              <h1 style="margin:0;font-size:24px;font-weight:800;color:#09090b;">New Feature Request</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 8px;">
              <p style="margin:0;font-size:14px;color:#71717a;">From: <strong style="color:#09090b;">${userEmail}</strong></p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 0;">
              <hr style="border:none;border-top:1px solid #e4e4e7;margin:0;" />
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 32px;">
              <p style="margin:0;font-size:16px;line-height:1.7;color:#09090b;white-space:pre-wrap;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
            </td>
          </tr>
          <tr>
            <td>
              <p style="margin:0;font-size:12px;color:#a1a1aa;">Sent from Roof app · Settings → Request a feature</p>
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
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const { message, userEmail } = await req.json()

    if (!message) {
      return new Response(JSON.stringify({ error: 'message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not set — skipping feature request email')
      return new Response(JSON.stringify({ skipped: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: TO_EMAIL,
        subject: `Feature request from ${userEmail}`,
        reply_to: userEmail !== 'anonymous' ? userEmail : undefined,
        html: buildEmailHtml(message, userEmail),
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      return new Response(JSON.stringify({ error: data }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ id: data.id }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
