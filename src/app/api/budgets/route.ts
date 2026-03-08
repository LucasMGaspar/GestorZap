import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: { persistSession: false, autoRefreshToken: false },
            realtime: { params: { eventsPerSecond: -1 } },
        }
    )
}

async function validateToken(token: string | null) {
    if (!token) return null
    const supabase = getSupabase()
    const { data: usuario } = await supabase
        .from('usuarios')
        .select('phone')
        .eq('token', token)
        .single()
    return usuario?.phone || null
}

export async function POST(req: NextRequest) {
    const token = req.nextUrl.searchParams.get('token')
    const phone = await validateToken(token)
    if (!phone) return NextResponse.json({ error: 'token_invalido' }, { status: 403 })

    const supabase = getSupabase()
    const { categoria, valor } = await req.json()

    if (!categoria || valor === undefined) {
        return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
    }

    const { data, error } = await supabase
        .from('budgets')
        .upsert({ phone, categoria, valor }, { onConflict: 'phone,categoria' })
        .select()
        .single()

    if (error) return NextResponse.json({ error }, { status: 400 })
    return NextResponse.json(data)
}
