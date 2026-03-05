import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function getAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
    )
}

function validateAdminKey(req: NextRequest): boolean {
    const adminKey = process.env.ADMIN_SECRET_KEY
    if (!adminKey) return false
    const provided = req.headers.get('x-admin-key') || req.nextUrl.searchParams.get('key')
    return provided === adminKey
}

// GET — listar todos os usuários
export async function GET(req: NextRequest) {
    if (!validateAdminKey(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const supabase = getAdminClient()
    const { data, error } = await supabase
        .from('usuarios')
        .select('id, phone, nome, email, status, data_expiracao, trial_ate, criado_em, ultimo_acesso, cakto_subscription_id, token')
        .order('criado_em', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ usuarios: data })
}

// PATCH — atualizar status de um usuário
export async function PATCH(req: NextRequest) {
    if (!validateAdminKey(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const body = await req.json()
    const { id, status } = body
    if (!id || !status) return NextResponse.json({ error: 'missing_fields' }, { status: 400 })

    const supabase = getAdminClient()
    const updates: any = { status }
    if (status === 'ativo') {
        const exp = new Date()
        exp.setDate(exp.getDate() + 32)
        updates.data_expiracao = exp.toISOString()
    }

    const { error } = await supabase.from('usuarios').update(updates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}
