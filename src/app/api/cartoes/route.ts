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
    const body = await req.json()

    const { data, error } = await supabase
        .from('cartoes')
        .insert({ phone, ...body })
        .select()
        .single()

    if (error) return NextResponse.json({ error }, { status: 400 })
    return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
    const token = req.nextUrl.searchParams.get('token')
    const phone = await validateToken(token)
    if (!phone) return NextResponse.json({ error: 'token_invalido' }, { status: 403 })

    const supabase = getSupabase()
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 })

    // Check if the card belongs to the user
    const { data: card } = await supabase.from('cartoes').select('phone').eq('id', id).single()
    if (!card || card.phone !== phone) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
    }

    const { error } = await supabase
        .from('cartoes')
        .delete()
        .eq('id', id)

    if (error) return NextResponse.json({ error }, { status: 400 })
    return NextResponse.json({ success: true })
}
