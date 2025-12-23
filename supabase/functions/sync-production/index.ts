import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProductionRow {
  'CALENDÁRIO[Data]': string
  'ZCA010[ZCA_NUMOPE]': string
  '[produção]': number
}

interface RequestBody {
  firstTableRows?: ProductionRow[]
  results?: Array<{
    tables?: Array<{
      rows?: ProductionRow[]
    }>
  }>
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const body: RequestBody = await req.json()
    console.log('Received request body:', JSON.stringify(body).substring(0, 500))

    // Extract rows from either firstTableRows or nested structure
    let rows: ProductionRow[] = []
    
    if (body.firstTableRows && Array.isArray(body.firstTableRows)) {
      rows = body.firstTableRows
    } else if (body.results?.[0]?.tables?.[0]?.rows) {
      rows = body.results[0].tables[0].rows
    }

    if (rows.length === 0) {
      console.log('No rows found in request')
      return new Response(
        JSON.stringify({ error: 'No data rows found in request', inserted: 0, ignored: 0 }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing ${rows.length} rows`)

    // Fetch all teams to create a name -> id map
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name')

    if (teamsError) {
      console.error('Error fetching teams:', teamsError)
      throw new Error(`Failed to fetch teams: ${teamsError.message}`)
    }

    const teamMap = new Map<string, string>()
    teams?.forEach(team => {
      teamMap.set(team.name, team.id)
    })

    console.log(`Found ${teamMap.size} registered teams`)

    // Process rows and filter only those with matching teams
    const dataToInsert: Array<{ team_id: string; date: string; production_value: number }> = []
    let ignoredCount = 0

    for (const row of rows) {
      const teamName = row['ZCA010[ZCA_NUMOPE]']
      const dateStr = row['CALENDÁRIO[Data]']
      const productionValue = row['[produção]']

      // Check if team exists
      const teamId = teamMap.get(teamName)
      
      if (!teamId) {
        console.log(`Ignoring row: team "${teamName}" not found`)
        ignoredCount++
        continue
      }

      // Parse date (format: 2025-12-16T00:00:00)
      const date = dateStr ? dateStr.split('T')[0] : null
      
      if (!date) {
        console.log(`Ignoring row: invalid date "${dateStr}"`)
        ignoredCount++
        continue
      }

      dataToInsert.push({
        team_id: teamId,
        date: date,
        production_value: productionValue
      })
    }

    console.log(`Prepared ${dataToInsert.length} rows for insert, ${ignoredCount} ignored`)

    // Delete all existing data
    const { error: deleteError } = await supabase
      .from('production_data')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows

    if (deleteError) {
      console.error('Error deleting old data:', deleteError)
      throw new Error(`Failed to delete old data: ${deleteError.message}`)
    }

    console.log('Old data deleted successfully')

    // Insert new data (upsert to handle duplicates)
    let insertedCount = 0
    
    if (dataToInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('production_data')
        .upsert(dataToInsert, { 
          onConflict: 'team_id,date',
          ignoreDuplicates: false 
        })
        .select()

      if (insertError) {
        console.error('Error inserting data:', insertError)
        throw new Error(`Failed to insert data: ${insertError.message}`)
      }

      insertedCount = inserted?.length || dataToInsert.length
    }

    console.log(`Inserted ${insertedCount} rows successfully`)

    const result = {
      success: true,
      inserted: insertedCount,
      ignored: ignoredCount,
      total_received: rows.length,
      timestamp: new Date().toISOString()
    }

    console.log('Sync completed:', result)

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in sync-production:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
