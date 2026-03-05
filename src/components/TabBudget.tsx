import React from 'react'
import { Target, AlertTriangle, CreditCard } from 'lucide-react'
import { Cartao, CompraParcelada } from '@/lib/supabase'
import { fmt, cc, ci, h2r, CAT } from '@/lib/utils'

type ParcelaAtiva = CompraParcelada & { pagas: number; restantes: number; valorParcela: number; total: number }

type Props = {
    catMap: Record<string, number>
    totalG: number
    parcelasAtivas: ParcelaAtiva[]
    cartoes: Cartao[]
    budgets: Record<string, number>
    editBudget: Record<string, string>
    setEditBudget: React.Dispatch<React.SetStateAction<Record<string, string>>>
    saveBudget: (cat: string, val: string) => void
    year: number
}

const cats = Object.keys(CAT)

export function TabBudget({ catMap, totalG, parcelasAtivas, cartoes, budgets, editBudget, setEditBudget, saveBudget, year }: Props) {
    return (
        <div>
            {/* Parcelas Ativas */}
            {parcelasAtivas.length > 0 && (
                <div className="glass" style={{ padding: 24, marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <span style={{ fontSize: '1rem' }}>ðŸ’³</span>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Parcelas Ativas</h3>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text3)', marginLeft: 'auto' }}>
                            {parcelasAtivas.length} compra{parcelasAtivas.length > 1 ? 's' : ''} parcelada{parcelasAtivas.length > 1 ? 's' : ''}
                        </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {parcelasAtivas.map((p, i) => {
                            const restantes = p.total - p.pagas
                            const pct = p.pagas / p.total * 100
                            const totalDevido = restantes * p.valorParcela
                            const done = restantes === 0
                            return (
                                <div key={i} style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{ width: 30, height: 30, borderRadius: 8, background: `rgba(${h2r(cc(p.categoria))},0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cc(p.categoria) }}>{ci(p.categoria)}</div>
                                            <div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{p.descricao}</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>{p.categoria} Â· {fmt(p.valorParcela)}/parcela</span>
                                                    {p.cartao_id && cartoes.find(c => c.id === p.cartao_id) && (
                                                        <span style={{ fontSize: '0.67rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text2)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                            <CreditCard size={10} /> {cartoes.find(c => c.id === p.cartao_id)?.nome_cartao}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: done ? '#10b981' : '#f59e0b' }}>{done ? 'âœ… Quitado!' : `${restantes} restante${restantes > 1 ? 's' : ''}`}</div>
                                            {!done && <div style={{ fontSize: '0.7rem', color: '#ef4444' }}>Ainda: {fmt(totalDevido)}</div>}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: done ? '#10b981' : 'linear-gradient(90deg,#00bfa5,#69f0ae)', transition: 'width 0.5s ease' }} />
                                        </div>
                                        <span style={{ fontSize: '0.68rem', color: 'var(--text3)', minWidth: 55, textAlign: 'right' }}>{p.pagas}/{p.total} pagas</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>Total em parcelas restantes:</span>
                        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ef4444' }}>{fmt(parcelasAtivas.reduce((a, p) => a + (p.total - p.pagas) * p.valorParcela, 0))}</span>
                    </div>
                </div>
            )}

            {/* Budget grid */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <Target size={16} color="#69f0ae" />
                <span style={{ fontSize: '0.82rem', color: 'var(--text2)' }}>Defina metas de orÃ§amento por categoria. Os dados sÃ£o sincronizados com sua conta.</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
                {cats.map(cat => {
                    const spent = catMap[cat] || 0
                    const budget = budgets[cat] || 0
                    const pct = budget > 0 ? Math.min(spent / budget * 100, 100) : 0
                    const over = budget > 0 && spent > budget
                    return (
                        <div key={cat} className="glass" style={{ padding: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: 9, background: `rgba(${h2r(cc(cat))},0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cc(cat) }}>{ci(cat)}</div>
                                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)' }}>{cat}</span>
                                </div>
                                {over && <AlertTriangle size={14} color="#f59e0b" />}
                            </div>
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 6 }}>
                                    <span style={{ color: 'var(--text2)' }}>Gasto: <strong style={{ color: over ? '#ef4444' : 'var(--text)' }}>{fmt(spent)}</strong></span>
                                    {budget > 0 && <span style={{ color: 'var(--text2)' }}>Meta: <strong style={{ color: 'var(--text)' }}>{fmt(budget)}</strong></span>}
                                </div>
                                {budget > 0 && (
                                    <>
                                        <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: over ? 'linear-gradient(90deg,#ef4444,#f87171)' : cc(cat), transition: 'width 0.5s ease' }} />
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: over ? '#ef4444' : 'var(--text3)', marginTop: 4, textAlign: 'right' }}>
                                            {over ? `Excedeu ${fmt(spent - budget)}` : `Restam ${fmt(budget - spent)} (${(100 - pct).toFixed(0)}%)`}
                                        </div>
                                    </>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <input
                                    type="number"
                                    value={editBudget[cat] ?? ''}
                                    onChange={e => setEditBudget(v => ({ ...v, [cat]: e.target.value }))}
                                    placeholder="Defina meta R$"
                                    className="input-field"
                                    style={{ flex: 1, fontSize: '0.8rem', padding: '7px 10px' }}
                                />
                                <button
                                    className="btn-primary"
                                    style={{ padding: '7px 12px', fontSize: '0.8rem' }}
                                    onClick={() => { saveBudget(cat, editBudget[cat] ?? ''); setEditBudget(v => ({ ...v, [cat]: '' })) }}
                                >
                                    Salvar
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
