import React, { useState } from 'react'
import { Search, Filter, Download, X, Edit3, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { Transacao, Cartao } from '@/lib/supabase'
import { MONTHS_PT, fmt, cc, ci, h2r } from '@/lib/utils'
import { TRow } from './TRow'
import { Empty } from './Empty'

const PAGE_SIZE = 50

type Props = {
    filteredTx: Transacao[]
    cartoes: Cartao[]
    month: number
    cats: string[]
    fType: 'all' | 'gasto' | 'receita' | 'parcela'
    fCat: string
    fMin: string
    fMax: string
    fStart: string
    fEnd: string
    showFilters: boolean
    search: string
    activeFilters: number
    setFType: (v: 'all' | 'gasto' | 'receita' | 'parcela') => void
    setFCat: (v: string) => void
    setFMin: (v: string) => void
    setFMax: (v: string) => void
    setFStart: (v: string) => void
    setFEnd: (v: string) => void
    setShowFilters: (v: boolean | ((prev: boolean) => boolean)) => void
    setSearch: (v: string) => void
    exportCSV: () => void
    onEdit: (t: Transacao) => void
}

export function TabTransactions({
    filteredTx, cartoes, month, cats,
    fType, fCat, fMin, fMax, fStart, fEnd, showFilters, search, activeFilters,
    setFType, setFCat, setFMin, setFMax, setFStart, setFEnd, setShowFilters, setSearch,
    exportCSV, onEdit
}: Props) {
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
    const visibleTx = filteredTx.slice(0, visibleCount)
    const hasMore = filteredTx.length > visibleCount

    return (
        <div className="glass" style={{ padding: 24 }}>
            {/* Filter bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>ðŸ§¾ TransaÃ§Ãµes â€” {MONTHS_PT[month]}</h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
                        <Search size={13} color="#94a3b8" />
                        <input
                            value={search}
                            onChange={e => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE) }}
                            placeholder="Buscar..."
                            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: '0.82rem', fontFamily: 'inherit', width: 140 }}
                        />
                    </div>
                    <button className="btn-ghost" onClick={() => setShowFilters(v => !v)} style={{ position: 'relative' }}>
                        <Filter size={13} /> Filtros
                        {activeFilters > 0 && <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#00bfa5', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{activeFilters}</span>}
                    </button>
                    <button className="btn-ghost" onClick={exportCSV}><Download size={13} /> CSV</button>
                </div>
            </div>

            {/* Filters panel */}
            {showFilters && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', marginBottom: 16 }}>
                    <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 4 }}>TIPO</label>
                        <div style={{ display: 'flex', gap: 4 }}>
                            {(['all', 'gasto', 'receita', 'parcela'] as const).map(t => (
                                <button key={t} onClick={() => { setFType(t); setVisibleCount(PAGE_SIZE) }}
                                    style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', background: fType === t ? 'rgba(99,102,241,0.2)' : 'transparent', borderColor: fType === t ? 'rgba(99,102,241,0.5)' : 'var(--border)', color: fType === t ? '#69f0ae' : 'var(--text2)' }}>
                                    {t === 'all' ? 'Todos' : t === 'gasto' ? 'Gastos' : t === 'receita' ? 'Receitas' : 'Parcelas'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 4 }}>CATEGORIA</label>
                        <select className="input-field" value={fCat} onChange={e => { setFCat(e.target.value); setVisibleCount(PAGE_SIZE) }} style={{ width: '100%', fontSize: '0.8rem' }}>
                            <option value="all">Todas</option>
                            {cats.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 4 }}>VALOR MÃN</label>
                        <input className="input-field" type="number" value={fMin} onChange={e => { setFMin(e.target.value); setVisibleCount(PAGE_SIZE) }} placeholder="R$ 0" style={{ width: '100%', fontSize: '0.8rem' }} />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 4 }}>VALOR MÃX</label>
                        <input className="input-field" type="number" value={fMax} onChange={e => { setFMax(e.target.value); setVisibleCount(PAGE_SIZE) }} placeholder="R$ 9999" style={{ width: '100%', fontSize: '0.8rem' }} />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 4 }}>DATA INÃCIO</label>
                        <input className="input-field" type="date" value={fStart} onChange={e => { setFStart(e.target.value); setVisibleCount(PAGE_SIZE) }} style={{ width: '100%', fontSize: '0.8rem' }} />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 4 }}>DATA FIM</label>
                        <input className="input-field" type="date" value={fEnd} onChange={e => { setFEnd(e.target.value); setVisibleCount(PAGE_SIZE) }} style={{ width: '100%', fontSize: '0.8rem' }} />
                    </div>
                    {activeFilters > 0 && (
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                            <button className="btn-ghost" onClick={() => { setFType('all'); setFCat('all'); setFMin(''); setFMax(''); setFStart(''); setFEnd(''); setVisibleCount(PAGE_SIZE) }} style={{ width: '100%', justifyContent: 'center' }}>
                                <X size={13} /> Limpar
                            </button>
                        </div>
                    )}
                </div>
            )}

            {filteredTx.length === 0 ? <Empty /> : (
                <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {visibleTx.map((t, i) => <TRow key={t.id} t={t} i={i} cartoes={cartoes} onEdit={() => onEdit(t)} />)}
                    </div>

                    {hasMore && (
                        <button
                            onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
                            className="btn-ghost"
                            style={{ width: '100%', justifyContent: 'center', marginTop: 14, padding: '10px 0' }}
                        >
                            Carregar mais ({filteredTx.length - visibleCount} restantes)
                        </button>
                    )}

                    <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text2)' }}><strong style={{ color: 'var(--text)' }}>{filteredTx.length}</strong> transaÃ§Ãµes{hasMore ? ` (exibindo ${visibleCount})` : ''}</span>
                        <div style={{ display: 'flex', gap: 16, fontSize: '0.78rem' }}>
                            <span style={{ color: '#ef4444' }}>Gastos: <strong>{fmt(filteredTx.filter(t => t.tipo === 'gasto' || t.tipo === 'parcela').reduce((a, t) => a + t.valor, 0))}</strong></span>
                            <span style={{ color: '#10b981' }}>Receitas: <strong>{fmt(filteredTx.filter(t => t.tipo === 'receita').reduce((a, t) => a + t.valor, 0))}</strong></span>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
