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

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: requestingUser }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if requesting user is admin
    const { data: adminRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .eq('role', 'admin')
      .single()

    if (!adminRole) {
      return new Response(
        JSON.stringify({ error: 'Apenas administradores podem gerenciar usuários' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { action, ...data } = await req.json()

    if (action === 'create') {
      const { name, username, password, role } = data

      if (!name || !username || !password || !role) {
        return new Response(
          JSON.stringify({ error: 'Dados incompletos' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const email = `${username}@fleetcontrol.local`

      // Check if username already exists
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('username', username)
        .single()

      if (existingProfile) {
        return new Response(
          JSON.stringify({ error: 'Usuário já existe' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Create user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, username }
      })

      if (authError) {
        console.error('Auth error:', authError)
        // Translate common error messages
        let errorMessage = authError.message
        if (authError.message.includes('already been registered') || authError.code === 'email_exists') {
          errorMessage = 'Este usuário já está cadastrado no sistema'
        }
        return new Response(
          JSON.stringify({ error: errorMessage }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Update profile with username
      await supabaseAdmin
        .from('profiles')
        .update({ username })
        .eq('id', authData.user.id)

      // Add role
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: authData.user.id, role })

      if (roleError) {
        console.error('Role error:', roleError)
      }

      console.log('User created:', username)

      return new Response(
        JSON.stringify({ success: true, userId: authData.user.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'reset-password') {
      const { userId, newPassword } = data

      if (!userId || !newPassword) {
        return new Response(
          JSON.stringify({ error: 'Dados incompletos' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword
      })

      if (error) {
        console.error('Reset password error:', error)
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Password reset for user:', userId)

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
