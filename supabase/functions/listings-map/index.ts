import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const params = url.searchParams

    const north = parseFloat(params.get('north') ?? '')
    const south = parseFloat(params.get('south') ?? '')
    const east = parseFloat(params.get('east') ?? '')
    const west = parseFloat(params.get('west') ?? '')
    const minPrice = parseInt(params.get('min_price') ?? '0')
    const maxPrice = parseInt(params.get('max_price') ?? '99999')
    const source = params.get('source') || null
    const type = params.get('type') || null

    // Validate bounds
    if (isNaN(north) || isNaN(south) || isNaN(east) || isNaN(west)) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid viewport bounds (north, south, east, west)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let query = supabase
      .from('listings')
      .select('id, title, price, lat, lng, address_raw, address_precision, source, city, neighborhood, type, size, rooms, furnished, image_url, images, created_at')
      .eq('is_active', true)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .gte('lat', south)
      .lte('lat', north)
      .gte('lng', west)
      .lte('lng', east)
      .gte('price', minPrice)
      .lte('price', maxPrice)
      .order('created_at', { ascending: false })
      .limit(150)

    if (source) {
      query = query.eq('source', source)
    }
    if (type) {
      query = query.eq('type', type)
    }

    const { data, error } = await query

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        listings: data,
        count: data?.length ?? 0,
        truncated: (data?.length ?? 0) >= 150,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
