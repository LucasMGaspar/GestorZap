import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// ─── Supabase admin client (server-side only) ─────────────────────────────────
function getAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
    )
}

// ─── Send WhatsApp message via Z-API ─────────────────────────────────────────
async function sendWhatsApp(phone: string, message: string) {
    const instanceId = process.env.ZAPI_INSTANCE_ID
    const token = process.env.ZAPI_TOKEN
    const clientToken = process.env.ZAPI_CLIENT_TOKEN
    if (!instanceId || !token) return

    const cleanPhone = phone.replace(/\D/g, '')

    await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Client-Token': clientToken || '',
        },
        body: JSON.stringify({ phone: cleanPhone, message }),
    })
}

// ─── Generate random token ─────────────────────────────────────────────────
function generateToken(): string {
    return crypto.randomBytes(24).toString('hex')
}

// ─── Main webhook handler ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    let body: any
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    // Validate secret
    const expectedSecret = process.env.CAKTO_WEBHOOK_SECRET
    if (expectedSecret && body.secret !== expectedSecret) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const event: string = body.event || ''
    const data = body.data || {}
    const customer = data.customer || {}

    const phone = (customer.phone || '').replace(/\D/g, '')
    const email = customer.email || ''
    const nome = customer.name || customer.nome || ''
    const subscriptionId = data.id || data.refId || ''
    const salesPageUrl = process.env.SALES_PAGE_URL || 'https://cakto.com.br'

    const supabase = getAdminClient()

    // ─── Assinatura criada / paga → ativar usuário ───────────────────────────
    if (['assinatura_criada', 'order.paid', 'purchase.approved', 'assinatura_ativada'].includes(event)) {
        if (!phone) {
            console.error('[Cakto] Webhook sem telefone do cliente:', body)
            return NextResponse.json({ error: 'phone_required' }, { status: 422 })
        }

        const expiracao = new Date()
        expiracao.setDate(expiracao.getDate() + 32) // 30 dias + 2 de margem

        // Verificar se usuário já existe
        const { data: existing } = await supabase.from('usuarios').select('id, token, phone').eq('phone', phone).single()

        let token = existing?.token
        let isNew = !existing

        if (isNew) {
            token = generateToken()
            const { error } = await supabase.from('usuarios').insert({
                phone,
                email,
                nome,
                token,
                status: 'ativo',
                data_expiracao: expiracao.toISOString(),
                cakto_subscription_id: subscriptionId,
                criado_em: new Date().toISOString(),
            })
            if (error) {
                console.error('[Cakto] Erro ao criar usuário:', error)
                return NextResponse.json({ error: 'db_error' }, { status: 500 })
            }
        } else {
            await supabase.from('usuarios').update({
                status: 'ativo',
                data_expiracao: expiracao.toISOString(),
                cakto_subscription_id: subscriptionId,
                email: email || undefined,
                nome: nome || undefined,
            }).eq('phone', phone)
        }

        // Envia WhatsApp de boas-vindas
        const dashUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://seudominio.com'}?token=${token}`
        const firstName = nome.split(' ')[0] || 'Bem-vindo'

        const msg = isNew
            ? `🎉 Olá, ${firstName}! Sua assinatura do *GestorFinanceiro* foi ativada!\n\n` +
            `Agora você pode registrar seus gastos e receitas aqui mesmo no WhatsApp, e acessar seu dashboard completo:\n\n` +
            `📊 *Seu dashboard:*\n${dashUrl}\n\n` +
            `_Salve este link! Ele é exclusivo para você._\n\n` +
            `Para começar, me mande uma mensagem como:\n` +
            `➡️ *gastei 50 no mercado*\n` +
            `➡️ *recebi 3000 de salário*`
            : `✅ Olá, ${firstName}! Sua assinatura do *GestorFinanceiro* foi renovada por mais 30 dias!\n\n` +
            `📊 Seu dashboard:\n${dashUrl}`

        await sendWhatsApp(phone, msg)

        return NextResponse.json({ ok: true, action: isNew ? 'created' : 'reactivated' })
    }

    // ─── Assinatura renovada ─────────────────────────────────────────────────
    if (['assinatura_renovada', 'subscription.renewed', 'recurrence.paid'].includes(event)) {
        if (!phone && !subscriptionId) return NextResponse.json({ ok: true, skipped: true })

        const expiracao = new Date()
        expiracao.setDate(expiracao.getDate() + 32)

        const query = phone
            ? supabase.from('usuarios').update({ status: 'ativo', data_expiracao: expiracao.toISOString() }).eq('phone', phone)
            : supabase.from('usuarios').update({ status: 'ativo', data_expiracao: expiracao.toISOString() }).eq('cakto_subscription_id', subscriptionId)

        await query

        return NextResponse.json({ ok: true, action: 'renewed' })
    }

    // ─── Assinatura cancelada / inadimplente / chargeback ────────────────────
    if (['assinatura_cancelada', 'assinatura_inadimplente', 'subscription.cancelled', 'subscription.overdue', 'chargeback', 'refund'].includes(event)) {
        const query = phone
            ? supabase.from('usuarios').update({ status: 'inativo' }).eq('phone', phone)
            : supabase.from('usuarios').update({ status: 'inativo' }).eq('cakto_subscription_id', subscriptionId)

        await query

        if (phone) {
            await sendWhatsApp(phone,
                `⚠️ Sua assinatura do *GestorFinanceiro* foi cancelada ou está inadimplente.\n\n` +
                `Para continuar usando, renove por apenas *R$29,90/mês*:\n` +
                `👉 ${salesPageUrl}`
            )
        }

        return NextResponse.json({ ok: true, action: 'deactivated' })
    }

    // Evento não tratado — ignorar silenciosamente
    return NextResponse.json({ ok: true, skipped: true, event })
}
