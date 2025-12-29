import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Mapping from external codes to internal team names
const TEAM_CODE_MAPPING: Record<string, string> = {
  '803006A': 'GOOO101M',
  '803006': 'GOOO101M',
  '803007A': 'GOOO102M',
  '803007': 'GOOO102M',
  '803008A': 'GOOO103M',
  '803008': 'GOOO103M',
  '803010A': 'GOOO105M',
  '803010': 'GOOO105M',
  '703014A': 'GOOV101M',
  '703014': 'GOOV101M',
  '703017A': 'GOOV104M',
  '703017': 'GOOV104M',
  '803009A': 'GOOO104M',
  '803009': 'GOOO104M',
  '803011A': 'GOOO106M',
  '803011': 'GOOO106M',
  '803012A': 'GOOO107M',
  '803012': 'GOOO107M',
  '803013A': 'GOOO108M',
  '803013': 'GOOO108M',
  '703015A': 'GOOV102M',
  '703015': 'GOOV102M',
  '703016A': 'GOOV103M',
  '703016': 'GOOV103M',
  '703000A': 'GOOV001M',
  '703000': 'GOOV001M',
  '703001A': 'GOOV002M',
  '703001': 'GOOV002M',
  '703002A': 'GOOV003M',
  '703002': 'GOOV003M',
  '703003A': 'GOOV004M',
  '703003': 'GOOV004M',
  '703004A': 'GOOV005M',
  '703004': 'GOOV005M',
  '703005A': 'GOOV006M',
  '703005': 'GOOV006M',
  '703006A': 'GOOP001M',
  '703006': 'GOOP001M',
  '703007A': 'GOOP002M',
  '703007': 'GOOP002M',
  '703008A': 'GOOP003M',
  '703008': 'GOOP003M',
  '703009A': 'GOOP004M',
  '703009': 'GOOP004M',
  '703010A': 'GOOP005M',
  '703010': 'GOOP005M',
  '703011A': 'GOOP006M',
  '703011': 'GOOP006M',
  '703012A': 'GOOP007M',
  '703012': 'GOOP007M',
  '703013A': 'GOOP008M',
  '703013': 'GOOP008M',
  '803000A': 'GOOO001M',
  '803000': 'GOOO001M',
  '803001A': 'GOOO002M',
  '803001': 'GOOO002M',
  '803002A': 'GOOO003M',
  '803002': 'GOOO003M',
  '803003A': 'GOOO004M',
  '803003': 'GOOO004M',
  '803004A': 'GOOO005M',
  '803004': 'GOOO005M',
  '803005A': 'GOOO006M',
  '803005': 'GOOO006M',
}

// Function to convert external code to internal team name
function convertTeamCode(externalCode: string): string {
  // First try exact match
  if (TEAM_CODE_MAPPING[externalCode]) {
    return TEAM_CODE_MAPPING[externalCode]
  }
  
  // Try without trailing 'A' if present
  const codeWithoutA = externalCode.replace(/A$/i, '')
  if (TEAM_CODE_MAPPING[codeWithoutA]) {
    return TEAM_CODE_MAPPING[codeWithoutA]
  }
  
  // Return original if no mapping found
  return externalCode
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
    const rawBody = await req.text()
    console.log('Raw body length:', rawBody.length)
    
    if (!rawBody || rawBody.length === 0) {
      console.log('Empty request body received')
      return new Response(
        JSON.stringify({ 
          error: 'Request body is empty',
          hint: 'Make sure to set Content-Type: application/json and send JSON in the body'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let body: any
    try {
      body = JSON.parse(rawBody)
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      console.log('Raw body preview:', rawBody.substring(0, 200))
      return new Response(
        JSON.stringify({ 
          error: 'Invalid JSON in request body',
          details: parseError instanceof Error ? parseError.message : 'Unknown parse error'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Received request body keys:', Object.keys(body))

    // Detect and unwrap 'body' wrapper if present (Power Automate sends this)
    let dataObj = body
    if (body.body && typeof body.body === 'object') {
      console.log('Detected body wrapper, unwrapping...')
      dataObj = body.body
      console.log('Unwrapped data keys:', Object.keys(dataObj))
    }

    // Extract rows from either firstTableRows or nested structure
    let rows: ProductionRow[] = []
    
    if (dataObj.firstTableRows && Array.isArray(dataObj.firstTableRows)) {
      rows = dataObj.firstTableRows
      console.log('Extracted rows from firstTableRows')
    } else if (dataObj.results?.[0]?.tables?.[0]?.rows) {
      rows = dataObj.results[0].tables[0].rows
      console.log('Extracted rows from results[0].tables[0].rows')
    }

    if (rows.length === 0) {
      console.log('No rows found in request')
      console.log('Data structure:', JSON.stringify(dataObj).substring(0, 300))
      return new Response(
        JSON.stringify({ 
          error: 'No data rows found in request', 
          inserted: 0, 
          ignored: 0,
          hint: 'Expected firstTableRows array or results[0].tables[0].rows'
        }),
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
      const rawTeamName = row['ZCA010[ZCA_NUMOPE]']
      const dateStr = row['CALENDÁRIO[Data]']
      const productionValue = row['[produção]']

      // Convert external code to internal team name
      const teamName = convertTeamCode(rawTeamName)

      // Check if team exists
      const teamId = teamMap.get(teamName)
      
      if (!teamId) {
        console.log(`Ignoring row: team "${rawTeamName}" -> "${teamName}" not found`)
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
