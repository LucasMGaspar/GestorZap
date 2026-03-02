import React from 'react'
import { Edit3, ArrowDownCircle, ArrowUpCircle, CreditCard } from 'lucide-react'
import { Transacao, Cartao } from '@/lib/supabase'
import { cc, ci, fmt, h2r, MONTHS_S } from '@/lib/utils'

export function TRow({ t, i: _i, cartoes = [], onEdit }: { t: Transacao; i: number, cartoes?: Cartao[], onEdit?: () => void }) {
    const isReceita = t.tipo === 'receita'
    const isParcela = t.tipo === 'parcela'
    const isCreditoAvulso = t.tipo === 'gasto' && !!t.cartao_id
    const col = isReceita ? '#10b981' : '#ef4444'
    const cartao = t.cartao_id ? cartoes.find(c => c.id === t.cartao_id) : null

    // Badge "Fatura Abr/26" para crédito avulso que pula de ciclo
    const faturaBadge = (() => {
        if (!isCreditoAvulso || !cartao) return null
        const d = new Date(t.data + 'T12:00:00')
        const buyDay = d.getDate()
        const buyMo = d.getMonth()
        const buyYr = d.getFullYear()
        if (buyDay < cartao.dia_fechamento) return null // mesmo mês, não precisa badge
        const fatMo = buyMo === 11 ? 0 : buyMo + 1
        const fatYr = buyMo === 11 ? buyYr + 1 : buyYr
        return `Fatura ${MONTHS_S[fatMo]}/${String(fatYr).slice(2)}`
    })()

    const metodoBadge = isParcela
        ? { label: 'Parcela', bg: 'rgba(99,102,241,0.15)', color: '#a78bfa' }
        : isCreditoAvulso
            ? { label: 'Crédito', bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' }
            : !isReceita
                ? { label: 'Débito/PIX', bg: 'rgba(71,85,105,0.15)', color: '#64748b' }
                : null

    return (
        <div
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', transition: 'all 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)' }}
        >
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `rgba(${h2r(cc(t.categoria))},0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: cc(t.categoria) }}>
                {ci(t.categoria)}
            </div>

            <div style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 4 }}>
                    {t.descricao}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: 20, background: `rgba(${h2r(cc(t.categoria))},0.12)`, color: cc(t.categoria), fontWeight: 600 }}>
                        {t.categoria}
                    </span>
                    {metodoBadge && (
                        <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: '4px', background: metodoBadge.bg, color: metodoBadge.color, fontWeight: 700 }}>
                            {metodoBadge.label}
                        </span>
                    )}
                    {cartao && (
                        <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text3)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CreditCard size={10} /> {cartao.nome_cartao}
                        </span>
                    )}
                    {faturaBadge && (
                        <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontWeight: 700 }}>
                            {faturaBadge}
                        </span>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: 5 }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: col }}>
                    {isReceita ? '+' : '-'}{fmt(t.valor)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: 0.85 }}>
                    {onEdit && (
                        <button
                            onClick={onEdit}
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '5px 10px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 600, marginRight: 4 }}
                            title="Editar Transação"
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                        >
                            <Edit3 size={13} style={{ marginRight: 4 }} /> <span className="hide-on-mobile">Editar</span>
                        </button>
                    )}
                    {isReceita ? <ArrowUpCircle size={11} color={col} /> : <ArrowDownCircle size={11} color={col} />}
                    <span style={{ fontSize: '0.66rem', fontWeight: 600, color: 'var(--text3)' }}>
                        {new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </span>
                </div>
            </div>
        </div>
    )
}
