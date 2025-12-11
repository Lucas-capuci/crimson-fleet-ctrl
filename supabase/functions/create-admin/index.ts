import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Check if admin already exists
    const { data: existingAdmin } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)

    if (existingAdmin && existingAdmin.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Admin user already exists' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: 'admin@elcop.local',
      password: 'Elcop@2025',
      email_confirm: true,
      user_metadata: { name: 'Administrador', username: 'admin' }
    })

    if (authError) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update profile with username
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ username: 'admin' })
      .eq('id', authData.user.id)

    if (profileError) {
      console.error('Profile error:', profileError)
    }

    // Add admin role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: authData.user.id, role: 'admin' })

    if (roleError) {
      console.error('Role error:', roleError)
      return new Response(
        JSON.stringify({ error: roleError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Admin user created successfully:', authData.user.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Admin created successfully',
        username: 'admin'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
