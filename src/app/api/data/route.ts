import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Server-side only — service_role key never reaches the browser
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
    const token = req.nextUrl.searchParams.get('token')
    const monthParam = req.nextUrl.searchParams.get('month')
    const yearParam = req.nextUrl.searchParams.get('year')

    if (!token) {
        return NextResponse.json({ error: 'token_required' }, { status: 401 })
    }

    // 1. Validate token → get phone
    const { data: usuario, error: uErr } = await supabase
        .from('usuarios')
        .select('phone, nome')
        .eq('token', token)
        .single()

    if (uErr || !usuario) {
        return NextResponse.json({ error: 'token_invalido' }, { status: 403 })
    }

    const phone = usuario.phone
    const month = monthParam ? parseInt(monthParam) : new Date().getMonth()
    const year = yearParam ? parseInt(yearParam) : new Date().getFullYear()

    // Date ranges
    const monthStr = String(month + 1).padStart(2, '0')
    const curStart = `${year}-${monthStr}-01`
    const curEnd = new Date(year, month + 1, 0).toISOString().split('T')[0]
    const [pm, py] = month === 0 ? [11, year - 1] : [month - 1, year]
    const prevStart = `${py}-${String(pm + 1).padStart(2, '0')}-01`
    const prevEnd = new Date(py, pm + 1, 0).toISOString().split('T')[0]
    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`

    // 2. Fetch all data in parallel
    const [r1, r2, r3, r4] = await Promise.all([
        supabase.from('transacoes').select('*').eq('phone', phone).gte('data', curStart).lte('data', curEnd).order('data', { ascending: false }),
        supabase.from('transacoes').select('*').eq('phone', phone).gte('data', prevStart).lte('data', prevEnd),
        supabase.from('transacoes').select('*').eq('phone', phone).gte('data', yearStart).lte('data', yearEnd),
        supabase.from('compras_parceladas').select('*').eq('phone', phone).eq('ativa', true).order('criado_em', { ascending: false }),
    ])

    // Update last access
    await supabase.from('usuarios').update({ ultimo_acesso: new Date().toISOString() }).eq('phone', phone)

    return NextResponse.json({
        phone,
        nome: usuario.nome,
        transacoes: r1.data ?? [],
        transacoesPrevMes: r2.data ?? [],
        transacoesAno: r3.data ?? [],
        comprasParceladas: r4.data ?? [],
    })
}
