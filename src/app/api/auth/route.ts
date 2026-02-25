import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    const token = req.nextUrl.searchParams.get('token')
    if (!token) return NextResponse.json({ error: 'token_required' }, { status: 401 })

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
    )

    const { data, error } = await supabase
        .from('usuarios')
        .select('phone, nome')
        .eq('token', token)
        .single()

    if (error || !data) return NextResponse.json({ error: 'token_invalido' }, { status: 403 })

    // Update last access (non-blocking)
    supabase.from('usuarios').update({ ultimo_acesso: new Date().toISOString() }).eq('token', token)

    return NextResponse.json({ phone: data.phone, nome: data.nome })
}
