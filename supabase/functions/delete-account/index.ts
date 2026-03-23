import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify the user is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create a client with the user's JWT to get their identity
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Use service role client for admin operations (cascade delete)
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const userId = user.id
    const errors: string[] = []

    // Delete user data from all tables (order matters for foreign keys)
    // Use try/catch per table so one missing table doesn't block the rest
    for (const table of ['saved_listings', 'alerts', 'push_tokens', 'analytics_events']) {
      const { error } = await adminClient.from(table).delete().eq('user_id', userId)
      if (error) errors.push(`${table}: ${error.message}`)
    }

    // profiles uses 'id' not 'user_id'
    const { error: profileErr } = await adminClient.from('profiles').delete().eq('id', userId)
    if (profileErr) errors.push(`profiles: ${profileErr.message}`)

    // Delete the auth user (this is permanent and irreversible)
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)
    if (deleteError) {
      return new Response(JSON.stringify({ error: `Auth delete failed: ${deleteError.message}`, details: errors }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Return 200 success (even if some table deletes had issues — user is gone)
    return new Response(JSON.stringify({ success: true, warnings: errors.length > 0 ? errors : undefined }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: `Internal server error: ${(err as Error).message}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
