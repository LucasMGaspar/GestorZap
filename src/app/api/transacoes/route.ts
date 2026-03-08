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

export async function PUT(req: NextRequest) {
    const token = req.nextUrl.searchParams.get('token')
    const phone = await validateToken(token)
    if (!phone) return NextResponse.json({ error: 'token_invalido' }, { status: 403 })

    const supabase = getSupabase()
    const body = await req.json()
    const { id, originalData, ...updates } = body

    if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 })

    // Check ownership
    const { data: tx } = await supabase.from('transacoes').select('phone').eq('id', id).single()
    if (!tx || tx.phone !== phone) return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

    const { data, error } = await supabase
        .from('transacoes')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

    if (error) return NextResponse.json({ error }, { status: 400 })

    // Se for parcela, atualizar faturas também (mesmo comportamento antigo do frontend)
    if (data && updates.tipo === 'parcela' && updates.compra_parcelada_id && originalData) {
        await supabase.from('faturas').update({
            valor: data.valor,
            descricao: data.descricao,
            vencimento: data.data,
        }).eq('compra_parcelada_id', updates.compra_parcelada_id)
            .eq('vencimento', originalData)
    }

    return NextResponse.json(data)
}

// Para pagamento de fatura
export async function POST(req: NextRequest) {
    const token = req.nextUrl.searchParams.get('token')
    const phone = await validateToken(token)
    if (!phone) return NextResponse.json({ error: 'token_invalido' }, { status: 403 })

    const supabase = getSupabase()
    const body = await req.json()
    // Ação específica: pagar fatura
    if (body.action === 'pagar_fatura') {
        const { cartaoId, itens, cartaoNome, diaVenc, total, hoje } = body

        // Check cartao owner
        const { data: card } = await supabase.from('cartoes').select('phone').eq('id', cartaoId).single()
        if (!card || card.phone !== phone) return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

        // Criar transação de pagamento
        await supabase.from('transacoes').insert({
            phone,
            tipo: 'gasto',
            valor: total,
            categoria: 'Transferência',
            descricao: `Pagamento fatura ${cartaoNome}`,
            data: hoje,
            cartao_id: null,
            criado_em: new Date().toISOString()
        })

        // Atualizar status das parcelas se existirem
        const parcelas = (itens || []).filter((t: any) => t.tipo === 'parcela' && t.compra_parcelada_id)
        for (const p of parcelas) {
            await supabase.from('faturas')
                .update({ status: 'pago' })
                .eq('compra_parcelada_id', p.compra_parcelada_id)
                .eq('vencimento', p.data)
        }

        return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'invalid_action' }, { status: 400 })
}
