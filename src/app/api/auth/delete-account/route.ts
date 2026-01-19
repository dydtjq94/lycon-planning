import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = await createServerClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if service role key exists
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not set')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Admin client for deleting user
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // 1. Get all simulations for this user
    const { data: simulations, error: simError } = await supabaseAdmin
      .from('simulations')
      .select('id')
      .eq('profile_id', user.id)

    if (simError) {
      console.error('Error fetching simulations:', simError)
    }

    const simulationIds = simulations?.map(s => s.id) || []

    // 2. Delete all financial data linked to simulations
    if (simulationIds.length > 0) {
      await Promise.all([
        supabaseAdmin.from('incomes').delete().in('simulation_id', simulationIds),
        supabaseAdmin.from('expenses').delete().in('simulation_id', simulationIds),
        supabaseAdmin.from('savings').delete().in('simulation_id', simulationIds),
        supabaseAdmin.from('debts').delete().in('simulation_id', simulationIds),
        supabaseAdmin.from('real_estates').delete().in('simulation_id', simulationIds),
        supabaseAdmin.from('physical_assets').delete().in('simulation_id', simulationIds),
        supabaseAdmin.from('national_pensions').delete().in('simulation_id', simulationIds),
        supabaseAdmin.from('retirement_pensions').delete().in('simulation_id', simulationIds),
        supabaseAdmin.from('personal_pensions').delete().in('simulation_id', simulationIds),
        supabaseAdmin.from('insurances').delete().in('simulation_id', simulationIds),
      ])

      // 3. Delete simulations
      await supabaseAdmin.from('simulations').delete().in('id', simulationIds)
    }

    // 4. Delete family_members and profile (linked directly to user)
    await supabaseAdmin.from('family_members').delete().eq('user_id', user.id)
    await supabaseAdmin.from('assets').delete().eq('user_id', user.id)
    await supabaseAdmin.from('profiles').delete().eq('id', user.id)

    // 5. Delete the auth user
    const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id)

    if (error) {
      console.error('Error deleting auth user:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
