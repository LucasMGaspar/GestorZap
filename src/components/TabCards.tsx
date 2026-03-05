import React, { useState } from 'react'
import { CreditCard, RefreshCw, X } from 'lucide-react'
import { Transacao, Cartao } from '@/lib/supabase'
import { fmt } from '@/lib/utils'
import { Empty } from './Empty'

type Props = {
    cartoes: Cartao[]
    newCard: { nome_cartao: string; dia_fechamento: number; dia_vencimento: number }
    savingCard: boolean
    pagandoFatura: string | null
    setNewCard: React.Dispatch<React.SetStateAction<{ nome_cartao: string; dia_fechamento: number; dia_vencimento: number }>>
    addCard: (e: React.FormEvent) => Promise<void>
    deleteCard: (id: string) => Promise<void>
    pagarFatura: (cartaoId: string, itens: Transacao[]) => Promise<void>
    gastosCredit: Transacao[]
    parcelasCartao: Transacao[]
    paidCartaoIds: Set<string>
}

export function TabCards({ cartoes, newCard, savingCard, pagandoFatura, setNewCard, addCard, deleteCard, pagarFatura, gastosCredit, parcelasCartao, paidCartaoIds }: Props) {
    const [cardError, setCardError] = useState('')

    const handleAddCard = async (e: React.FormEvent) => {
        e.preventDefault()
        setCardError('')
        const nome = newCard.nome_cartao.trim()
        if (!nome) return

        // Validação: nome duplicado
        if (cartoes.some(c => c.nome_cartao.toLowerCase() === nome.toLowerCase())) {
            setCardError(`Já existe um cartão chamado "${nome}". Escolha outro nome.`)
            return
        }

        await addCard(e)
    }

    const itensNaFatura = [...gastosCredit, ...parcelasCartao]
    const porCartao = cartoes.reduce<Record<string, { id: string; nome: string; itens: Transacao[] }>>((acc, c) => {
        const ci = itensNaFatura.filter(t => t.cartao_id === c.id)
        if (ci.length > 0) acc[c.id] = { id: c.id, nome: c.nome_cartao, itens: ci }
        return acc
    }, {})
    const gruposFatura = Object.values(porCartao)

    const hues = [250, 320, 200, 280, 150]

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20, alignItems: 'start' }}>
            <div className="glass" style={{ padding: 24 }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 16 }}>Meus Cartões</h3>
                {cartoes.length === 0 ? <Empty msg="Nenhum cartão cadastrado" /> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {cartoes.map((c) => {
                            const hue = hues[c.nome_cartao.length % hues.length]
                            const bg1 = `hsl(${hue}, 60%, 25%)`
                            const bg2 = `hsl(${hue + 30}, 60%, 15%)`
                            const accent = `hsl(${hue + 15}, 80%, 65%)`
                            const grupo = porCartao[c.id]
                            const totalFatura = grupo ? grupo.itens.reduce((a, t) => a + t.valor, 0) : 0
                            const jaPagou = paidCartaoIds.has(c.id)

                            return (
                                <div key={c.id} style={{ position: 'relative', padding: '20px', borderRadius: '16px', background: `linear-gradient(135deg, ${bg1}, ${bg2})`, boxShadow: '0 10px 30px -10px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden', minHeight: '140px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: 'white', fontFamily: 'monospace' }}>
                                    {/* Decorative circles */}
                                    <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
                                    <div style={{ position: 'absolute', bottom: -20, left: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'sans-serif' }}>{c.nome_cartao}</div>
                                            {/* Chip */}
                                            <div style={{ width: 36, height: 26, borderRadius: 4, background: 'linear-gradient(135deg, #d4af37 0%, #aa8000 100%)', opacity: 0.8, position: 'relative', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.2)' }}>
                                                <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(0,0,0,0.2)' }} />
                                                <div style={{ position: 'absolute', left: '30%', top: 0, bottom: 0, width: 1, background: 'rgba(0,0,0,0.2)' }} />
                                                <div style={{ position: 'absolute', left: '70%', top: 0, bottom: 0, width: 1, background: 'rgba(0,0,0,0.2)' }} />
                                            </div>
                                        </div>
                                        <button onClick={() => deleteCard(c.id)} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', padding: 6, cursor: 'pointer', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')} onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')} title="Excluir Cartão">
                                            <X size={14} />
                                        </button>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', position: 'relative', zIndex: 1, marginTop: 24 }}>
                                        <div style={{ display: 'flex', gap: 20 }}>
                                            <div>
                                                <div style={{ fontSize: '0.55rem', opacity: 0.6, letterSpacing: '0.05em', marginBottom: 2 }}>FECHAMENTO</div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Dia {String(c.dia_fechamento).padStart(2, '0')}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.55rem', opacity: 0.6, letterSpacing: '0.05em', marginBottom: 2 }}>VENCIMENTO</div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: accent }}>Dia {String(c.dia_vencimento).padStart(2, '0')}</div>
                                            </div>
                                        </div>
                                        <div style={{ opacity: 0.8 }}><CreditCard size={28} /></div>
                                    </div>

                                    {/* Fatura badge */}
                                    {totalFatura > 0 && (
                                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 14px', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                            <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>{jaPagou ? '✅ Fatura paga' : `Fatura: ${fmt(totalFatura)}`}</span>
                                            {!jaPagou && grupo && (
                                                <button onClick={() => pagarFatura(c.id, grupo.itens)} disabled={pagandoFatura === c.id} style={{ fontSize: '0.68rem', fontWeight: 700, background: 'rgba(16,185,129,0.25)', border: '1px solid rgba(16,185,129,0.4)', color: '#10b981', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit', opacity: pagandoFatura === c.id ? 0.6 : 1 }}>
                                                    {pagandoFatura === c.id ? '...' : 'Paguei'}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            <div className="glass" style={{ padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CreditCard size={16} color="#10b981" /></div>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Novo Cartão</h3>
                </div>

                <p style={{ fontSize: '0.78rem', color: 'var(--text2)', marginBottom: 20, lineHeight: 1.5 }}>
                    Cadastre a data de fechamento e vencimento das suas faturas para receber avisos automáticos no seu WhatsApp para não esquecer de pagar!
                </p>

                {cardError && (
                    <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: '0.8rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>⚠️</span> {cardError}
                    </div>
                )}

                <form onSubmit={handleAddCard} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 6 }}>NOME DO CARTÃO (Ex: Nubank)</label>
                        <input className="input-field" type="text" value={newCard.nome_cartao} onChange={e => { setNewCard(v => ({ ...v, nome_cartao: e.target.value })); setCardError('') }} placeholder="Nome do cartão" required style={{ width: '100%' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 6 }}>DIA FECHAMENTO</label>
                            <input className="input-field" type="number" min="1" max="28" value={newCard.dia_fechamento} onChange={e => setNewCard(v => ({ ...v, dia_fechamento: parseInt(e.target.value) || 1 }))} required style={{ width: '100%' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 6 }}>DIA VENCIMENTO</label>
                            <input className="input-field" type="number" min="1" max="28" value={newCard.dia_vencimento} onChange={e => setNewCard(v => ({ ...v, dia_vencimento: parseInt(e.target.value) || 1 }))} required style={{ width: '100%' }} />
                        </div>
                    </div>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: -8 }}>
                        💡 Use no máximo dia 28 para evitar problemas em meses curtos (fevereiro).
                    </p>
                    <button type="submit" disabled={savingCard || !newCard.nome_cartao.trim()} className="btn-primary" style={{ marginTop: 8, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        {savingCard ? <RefreshCw size={16} className="animate-spin" /> : <>+</>}
                        Adicionar Cartão
                    </button>
                </form>
            </div>
        </div>
    )
}
