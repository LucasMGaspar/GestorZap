'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSupabase, Transacao, Cartao } from '@/lib/supabase'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, Legend, LineChart, Line
} from 'recharts'
import {
  Wallet, RefreshCw, TrendingDown, TrendingUp, ArrowDownCircle, ArrowUpCircle,
  Calendar, MessageCircle, ShoppingCart, Car, Heart, BookOpen, Gamepad2, Home,
  Shirt, CreditCard, ArrowLeftRight, MoreHorizontal, BarChart2, Search,
  Download, Target, ChevronUp, ChevronDown, AlertTriangle, Zap, Filter, X
} from 'lucide-react'

// ─── Types & Constants ────────────────────────────────────────────────────────
const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const MONTHS_S = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const CAT: Record<string, { color: string; icon: React.ReactNode }> = {
  'Alimentação': { color: '#f59e0b', icon: <ShoppingCart size={13} /> },
  'Transporte': { color: '#3b82f6', icon: <Car size={13} /> },
  'Saúde': { color: '#10b981', icon: <Heart size={13} /> },
  'Educação': { color: '#8b5cf6', icon: <BookOpen size={13} /> },
  'Lazer': { color: '#ec4899', icon: <Gamepad2 size={13} /> },
  'Moradia': { color: '#f97316', icon: <Home size={13} /> },
  'Roupas': { color: '#06b6d4', icon: <Shirt size={13} /> },
  'Assinaturas': { color: '#6366f1', icon: <CreditCard size={13} /> },
  'Transferência': { color: '#64748b', icon: <ArrowLeftRight size={13} /> },
  'Outros': { color: '#94a3b8', icon: <MoreHorizontal size={13} /> },
}
const cc = (c: string) => CAT[c]?.color ?? '#94a3b8'
const ci = (c: string) => CAT[c]?.icon ?? <MoreHorizontal size={13} />
const fmt = (v: number) => { const parts = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).formatToParts(v); return parts.map(p => p.type === 'currency' ? p.value : p.value).join('').replace('R$', 'R$ ') }
const h2r = (hex: string) => { const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16); return `${r},${g},${b}` }

// ─── Tooltip Components ───────────────────────────────────────────────────────
const CT = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0d1220', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 16px', boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>
      {label && <p style={{ color: '#64748b', fontSize: 11, marginBottom: 8 }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ color: '#94a3b8' }}>{p.name}:</span>
          <span style={{ color: '#f1f5f9', fontWeight: 700 }}>{fmt(p.value ?? 0)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
type CompraParcelada = { id: string; phone: string; descricao: string; valor_total: number; n_parcelas: number; valor_parcela: number; categoria: string; data_inicio: string; ativa: boolean; criado_em: string; cartao_id?: string }

function Dashboard() {
  const sp = useSearchParams()
  const [token] = useState(sp.get('token') || '')
  const [authError, setAuthError] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [txAll, setTxAll] = useState<Transacao[]>([])
  const [txPrev, setTxPrev] = useState<Transacao[]>([])
  const [txYear, setTxYear] = useState<Transacao[]>([])
  const [comprasParceladas, setComprasParceladas] = useState<CompraParcelada[]>([])
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [loading, setLoading] = useState(false)
  const [month, setMonth] = useState(new Date().getMonth())
  const [year, setYear] = useState(new Date().getFullYear())
  const [tab, setTab] = useState<'transactions' | 'cards' | 'budget' | 'annual' | 'overview'>('transactions')
  // Filters
  const [fType, setFType] = useState<'all' | 'gasto' | 'receita'>('all')
  const [fCat, setFCat] = useState('all')
  const [fMin, setFMin] = useState('')
  const [fMax, setFMax] = useState('')
  const [fStart, setFStart] = useState('')
  const [fEnd, setFEnd] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [search, setSearch] = useState('')
  // Budgets (localStorage)
  const [budgets, setBudgets] = useState<Record<string, number>>({})
  const [editBudget, setEditBudget] = useState<Record<string, string>>({})

  // Form for new Card
  const [newCard, setNewCard] = useState({ nome_cartao: '', dia_fechamento: 1, dia_vencimento: 10 })
  const [savingCard, setSavingCard] = useState(false)

  // Load budgets
  useEffect(() => { try { const b = localStorage.getItem('fin_budgets'); if (b) setBudgets(JSON.parse(b)) } catch { } }, [])
  const saveBudget = (cat: string, val: string) => {
    const n = parseFloat(val); if (isNaN(n) || n <= 0) return
    const next = { ...budgets, [cat]: n }; setBudgets(next); localStorage.setItem('fin_budgets', JSON.stringify(next))
  }

  const fetchData = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setAuthError(null)
    try {
      // Step 1: validate token directly in browser (client-side) to avoid Vercel timeouts
      const client = getSupabase()
      if (!client) { setLoading(false); return }

      const { data: userData, error: userErr } = await client
        .from('usuarios')
        .select('phone')
        .eq('token', token)
        .single()

      if (userErr || !userData) { setAuthError('token_invalido'); setLoading(false); return }
      const resolvedPhone = userData.phone
      setPhone(resolvedPhone)

      // Step 2: fetch data directly from Supabase
      const s = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const e = new Date(year, month + 1, 0).toISOString().split('T')[0]
      const [pm, py] = month === 0 ? [11, year - 1] : [month - 1, year]
      const ps = `${py}-${String(pm + 1).padStart(2, '0')}-01`
      const pe = new Date(py, pm + 1, 0).toISOString().split('T')[0]
      const ys = `${year}-01-01`, ye = `${year}-12-31`
      const [r1, r2, r3, r4, r5] = await Promise.all([
        client.from('transacoes').select('*').eq('phone', resolvedPhone).gte('data', s).lte('data', e).order('data', { ascending: false }),
        client.from('transacoes').select('*').eq('phone', resolvedPhone).gte('data', ps).lte('data', pe),
        client.from('transacoes').select('*').eq('phone', resolvedPhone).gte('data', ys).lte('data', ye),
        client.from('compras_parceladas').select('*').eq('phone', resolvedPhone).eq('ativa', true).order('criado_em', { ascending: false }),
        client.from('cartoes').select('*').eq('phone', resolvedPhone).order('nome_cartao', { ascending: true })
      ])
      if (r1.data) setTxAll(r1.data)
      if (r2.data) setTxPrev(r2.data)
      if (r3.data) setTxYear(r3.data)
      setComprasParceladas(r4.data ?? [])
      setCartoes(r5.data ?? [])
    } catch { setAuthError('erro_rede') }
    setLoading(false)
  }, [token, month, year])

  useEffect(() => { fetchData() }, [fetchData])

  const addCard = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCard.nome_cartao.trim() || !phone) return
    setSavingCard(true)
    const client = getSupabase()
    if (client) {
      const resp = await client.from('cartoes').insert({ phone, ...newCard }).select().single()
      if (resp.data) setCartoes(prev => [...prev, resp.data].sort((a, b) => a.nome_cartao.localeCompare(b.nome_cartao)))
      setNewCard({ nome_cartao: '', dia_fechamento: 1, dia_vencimento: 10 })
    }
    setSavingCard(false)
  }

  const deleteCard = async (id: string) => {
    if (!confirm('Deseja excluir este cartão?')) return
    const client = getSupabase()
    if (client) {
      await client.from('cartoes').delete().eq('id', id)
      setCartoes(prev => prev.filter(c => c.id !== id))
    }
  }

  // ─── Derived ──────────────────────────────────────────────────────────────
  const gastos = txAll.filter(t => t.tipo === 'gasto')
  const receitas = txAll.filter(t => t.tipo === 'receita')
  const totalG = gastos.reduce((a, t) => a + t.valor, 0)
  const totalR = receitas.reduce((a, t) => a + t.valor, 0)
  const saldo = totalR - totalG
  const pGastos = txPrev.filter(t => t.tipo === 'gasto').reduce((a, t) => a + t.valor, 0)
  const pReceitas = txPrev.filter(t => t.tipo === 'receita').reduce((a, t) => a + t.valor, 0)
  const pct = (now: number, prev: number) => prev === 0 ? null : Math.round((now - prev) / prev * 100)
  const pctG = pct(totalG, pGastos), pctR = pct(totalR, pReceitas)

  // Category map
  const catMap = useMemo(() => {
    const m: Record<string, number> = {}
    gastos.forEach(t => { m[t.categoria] = (m[t.categoria] || 0) + t.valor })
    return m
  }, [gastos])
  const pieData = Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))

  // Daily map
  const areaData = useMemo(() => {
    const m: Record<string, { gastos: number; receitas: number; acumulado?: number }> = {}
    txAll.forEach(t => { if (!m[t.data]) m[t.data] = { gastos: 0, receitas: 0 }; t.tipo === 'gasto' ? m[t.data].gastos += t.valor : m[t.data].receitas += t.valor })
    let acc = 0
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b)).map(([data, v]) => {
      acc += v.receitas - v.gastos
      return { dia: data.split('-')[2], gastos: v.gastos, receitas: v.receitas, acumulado: acc }
    })
  }, [txAll])

  // Forecast
  const today = new Date().getDate()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const avgDailySpend = today > 0 ? totalG / today : 0
  const forecastTotal = avgDailySpend * daysInMonth
  const forecastRemaining = forecastTotal - totalG

  // Day-of-week heatmap
  const dowData = useMemo(() => {
    const m = Array(7).fill(0)
    gastos.forEach(t => { const d = new Date(t.data + 'T12:00:00'); m[d.getDay()] += t.valor })
    const max = Math.max(...m, 1)
    return WEEK_DAYS.map((label, i) => ({ label, value: m[i], pct: m[i] / max }))
  }, [gastos])

  // Annual data
  const annualData = useMemo(() => {
    const m: Record<number, { gastos: number; receitas: number }> = {}
    for (let i = 0; i < 12; i++) m[i] = { gastos: 0, receitas: 0 }
    txYear.forEach(t => { const mo = new Date(t.data + 'T12:00:00').getMonth(); t.tipo === 'gasto' ? m[mo].gastos += t.valor : m[mo].receitas += t.valor })
    return MONTHS_S.map((name, i) => ({ name, gastos: m[i].gastos, receitas: m[i].receitas, saldo: m[i].receitas - m[i].gastos }))
  }, [txYear])

  // Parcelas ativas — agora vem direto da tabela compras_parceladas
  const parcelasAtivas = useMemo(() => {
    return comprasParceladas.map(p => {
      const start = new Date(p.data_inicio + 'T12:00:00')
      const now = new Date()
      const elapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1
      const pagas = Math.min(Math.max(elapsed, 0), p.n_parcelas)
      return { ...p, pagas, restantes: p.n_parcelas - pagas, valorParcela: p.valor_parcela, total: p.n_parcelas }
    })
  }, [comprasParceladas])

  // Filtered transactions
  const filteredTx = useMemo(() => {
    let tx = [...txAll]
    if (fType !== 'all') tx = tx.filter(t => t.tipo === fType)
    if (fCat !== 'all') tx = tx.filter(t => t.categoria === fCat)
    if (fMin) tx = tx.filter(t => t.valor >= parseFloat(fMin))
    if (fMax) tx = tx.filter(t => t.valor <= parseFloat(fMax))
    if (fStart) tx = tx.filter(t => t.data >= fStart)
    if (fEnd) tx = tx.filter(t => t.data <= fEnd)
    if (search) tx = tx.filter(t => t.descricao?.toLowerCase().includes(search.toLowerCase()) || t.categoria?.toLowerCase().includes(search.toLowerCase()))
    return tx
  }, [txAll, fType, fCat, fMin, fMax, fStart, fEnd, search])

  const activeFilters = [fType !== 'all', fCat !== 'all', !!fMin, !!fMax, !!fStart, !!fEnd].filter(Boolean).length

  // CSV Export
  const exportCSV = () => {
    const rows = [['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor'], ...filteredTx.map(t => [t.data, t.tipo, t.categoria, t.descricao, t.valor.toFixed(2).replace('.', ',')])]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(';')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `transacoes-${MONTHS_PT[month]}-${year}.csv`; a.click()
  }

  const years = [year - 1, year, year + 1]
  const cats = Object.keys(CAT)

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 0 }}>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '60%', height: '60%', background: 'radial-gradient(circle,rgba(99,102,241,0.06) 0%,transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '60%', height: '60%', background: 'radial-gradient(circle,rgba(139,92,246,0.05) 0%,transparent 70%)', borderRadius: '50%' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1280, margin: '0 auto', padding: '28px 24px' }} className="mobile-pad">
        {/* Header */}
        <header className="dash-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(99,102,241,0.4)' }}>
              <Wallet size={22} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 800, background: 'linear-gradient(135deg,#f1f5f9,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Gestor Financeiro</h1>
              <p style={{ fontSize: '0.76rem', color: 'var(--text2)', marginTop: 1 }}>Dashboard pessoal via WhatsApp</p>
            </div>
          </div>
          <div className="dash-header-controls" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {phone && <span style={{ fontSize: '0.75rem', color: 'var(--text2)', padding: '7px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>📱 +{phone}</span>}
            <select className="input-field" value={month} onChange={e => setMonth(Number(e.target.value))}>
              {MONTHS_S.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select className="input-field" value={year} onChange={e => setYear(Number(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button className="btn-ghost" onClick={fetchData} disabled={loading}>
              <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              {loading ? '...' : 'Atualizar'}
            </button>
          </div>
        </header>

        {authError === 'token_required' || (!token && !loading) ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <span style={{ fontSize: '2rem' }}>🔒</span>
            </div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 8 }}>Acesso Restrito</h2>
            <p style={{ color: 'var(--text2)', fontSize: '0.9rem' }}>Este dashboard só pode ser acessado pelo link enviado no seu WhatsApp.</p>
          </div>
        ) : authError === 'token_invalido' ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <span style={{ fontSize: '2rem' }}>❌</span>
            </div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 8 }}>Token Inválido</h2>
            <p style={{ color: 'var(--text2)', fontSize: '0.9rem' }}>O link de acesso não é válido ou expirou. Peça um novo link pelo WhatsApp.</p>
          </div>
        ) : loading && !phone ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text2)' }}>Carregando...</div>
        ) : (
          <div>
            {/* Month label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <Calendar size={12} color="#a78bfa" />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#a78bfa' }}>{MONTHS_PT[month]} {year}</span>
              </div>
              <span style={{ color: 'var(--text3)', fontSize: '0.78rem' }}>{txAll.length} transações</span>
            </div>

            {/* Summary Cards */}
            <div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 16 }}>
              <MCard label="Total Gastos" value={fmt(totalG)} sub={`${gastos.length} transações`} icon={<ArrowDownCircle size={18} />} color="#ef4444" grad="rgba(239,68,68,0.1)" pct={pctG} pctInvert />
              <MCard label="Total Receitas" value={fmt(totalR)} sub={`${receitas.length} transações`} icon={<ArrowUpCircle size={18} />} color="#10b981" grad="rgba(16,185,129,0.1)" pct={pctR} />
              <MCard label="Saldo" value={fmt(saldo)} sub={saldo >= 0 ? 'Em dia ✨' : 'Atenção ⚠️'} icon={saldo >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />} color={saldo >= 0 ? '#10b981' : '#ef4444'} grad={saldo >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'} highlight />
              <MCard label="Gasto Médio/tx" value={fmt(gastos.length ? totalG / gastos.length : 0)} sub="por transação" icon={<BarChart2 size={18} />} color="#6366f1" grad="rgba(99,102,241,0.1)" />
            </div>

            {/* Insights row */}
            {txAll.length > 0 && (
              <div className="insight-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10, marginBottom: 20 }}>
                <ICard emoji="🔮" title="Previsão do mês" value={fmt(forecastTotal)} sub={`Ainda: ${fmt(forecastRemaining)}`} color="#f59e0b" />
                <ICard emoji="📈" title="Média diária" value={fmt(avgDailySpend)} sub="de gastos por dia" color="#ef4444" />
              </div>
            )}

            {/* Tabs */}
            <div className="tab-bar" style={{ display: 'flex', gap: 4, marginBottom: 18, background: 'rgba(255,255,255,0.04)', padding: 4, borderRadius: 12, width: 'fit-content', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
              {(['transactions', 'cards', 'budget', 'annual', 'overview'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  style={{
                    padding: '7px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.2s',
                    background: tab === t ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'transparent',
                    color: tab === t ? 'white' : '#94a3b8'
                  }}>
                  {t === 'transactions' ? '🧾 Transações' : t === 'cards' ? '💳 Cartões' : t === 'budget' ? '🎯 Orçamento' : t === 'annual' ? '📅 Anual' : '📊 Visão Geral'}
                </button>
              ))}
            </div>

            {/* ─── OVERVIEW TAB ─────────────────────────────────────────── */}
            {tab === 'overview' && (
              txAll.length === 0 ? <Empty /> : (
                <div>
                  {/* Area + Pie */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 14, marginBottom: 14 }}>
                    <div className="glass" style={{ padding: 24 }}>
                      <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>📈 Evolução Diária</h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={areaData}>
                          <defs>
                            <linearGradient id="gG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
                            <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.25} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis dataKey="dia" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} />
                          <Tooltip content={<CT />} />
                          <Legend formatter={v => <span style={{ color: '#94a3b8', fontSize: '0.76rem' }}>{v}</span>} />
                          <Area type="monotone" dataKey="gastos" stroke="#ef4444" strokeWidth={2} fill="url(#gG)" name="Gastos" dot={false} />
                          <Area type="monotone" dataKey="receitas" stroke="#10b981" strokeWidth={2} fill="url(#gR)" name="Receitas" dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="glass" style={{ padding: 24 }}>
                      <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 18 }}>💸 Gastos por Categoria</h3>
                      {pieData.length > 0 ? (
                        <>
                          <ResponsiveContainer width="100%" height={170}>
                            <PieChart>
                              <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                                {pieData.map((e, i) => <Cell key={i} fill={cc(e.name)} stroke="transparent" />)}
                              </Pie>
                              <Tooltip formatter={(v: any) => fmt(v ?? 0)} labelFormatter={(l: any) => l} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                            {pieData.slice(0, 6).map((e, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: cc(e.name) }} />
                                  <span style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>{e.name}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ width: 70, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${e.value / totalG * 100}%`, background: cc(e.name), borderRadius: 2 }} />
                                  </div>
                                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', minWidth: 65, textAlign: 'right' }}>{fmt(e.value)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : <Empty msg="Nenhum gasto" />}
                    </div>
                  </div>

                  {/* Cumulative + Heatmap */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 14, marginBottom: 14 }}>
                    <div className="glass" style={{ padding: 24 }}>
                      <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 18 }}>💰 Saldo Acumulado</h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={areaData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis dataKey="dia" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} />
                          <Tooltip content={<CT />} />
                          <Line type="monotone" dataKey="acumulado" stroke="#6366f1" strokeWidth={2.5} dot={false} name="Saldo" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="glass" style={{ padding: 24 }}>
                      <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 18 }}>🗓️ Gastos por Dia da Semana</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                        {dowData.map((d, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text2)', minWidth: 28 }}>{d.label}</span>
                            <div style={{ flex: 1, height: 20, borderRadius: 6, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${d.pct * 100}%`, borderRadius: 6, background: `rgba(99,102,241,${0.3 + d.pct * 0.7})`, transition: 'width 0.6s ease', display: 'flex', alignItems: 'center', paddingLeft: 6 }}>
                                {d.value > 0 && <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.8)', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(d.value)}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Bar ranking */}
                  {pieData.length > 0 && (
                    <div className="glass" style={{ padding: 24 }}>
                      <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 18 }}>🏅 Ranking por Categoria</h3>
                      <ResponsiveContainer width="100%" height={Math.max(140, pieData.length * 40)}>
                        <BarChart data={pieData} layout="vertical" margin={{ left: 0, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                          <XAxis type="number" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} />
                          <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 12 }} width={100} axisLine={false} tickLine={false} />
                          <Tooltip formatter={(v: any) => fmt(v ?? 0)} />
                          <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                            {pieData.map((e, i) => <Cell key={i} fill={cc(e.name)} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Forecast banner */}
                  <div className="glass" style={{ padding: 20, marginTop: 14, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Zap size={18} color="#f59e0b" />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Previsão de fechamento</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f59e0b' }}>{fmt(forecastTotal)}</div>
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text2)', marginBottom: 6 }}>
                        <span>Gasto até hoje: {fmt(totalG)}</span>
                        <span>Dia {today}/{daysInMonth}</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(today / daysInMonth * 100, 100)}%`, borderRadius: 4, background: 'linear-gradient(90deg,#6366f1,#f59e0b)' }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>Restante estimado</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ef4444' }}>{fmt(forecastRemaining)}</div>
                    </div>
                  </div>
                </div>
              )
            )}

            {/* ─── TRANSACTIONS TAB ─────────────────────────────────────── */}
            {tab === 'transactions' && (
              <div className="glass" style={{ padding: 24 }}>
                {/* Filter bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>🧾 Transações — {MONTHS_PT[month]}</h3>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
                      <Search size={13} color="#94a3b8" />
                      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: '0.82rem', fontFamily: 'inherit', width: 140 }} />
                    </div>
                    <button className="btn-ghost" onClick={() => setShowFilters(v => !v)} style={{ position: 'relative' }}>
                      <Filter size={13} /> Filtros
                      {activeFilters > 0 && <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#6366f1', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{activeFilters}</span>}
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
                        {['all', 'gasto', 'receita'].map(t => (
                          <button key={t} onClick={() => setFType(t as any)}
                            style={{
                              padding: '5px 10px', borderRadius: 8, border: '1px solid', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                              background: fType === t ? 'rgba(99,102,241,0.2)' : 'transparent',
                              borderColor: fType === t ? 'rgba(99,102,241,0.5)' : 'var(--border)',
                              color: fType === t ? '#a78bfa' : 'var(--text2)'
                            }}>
                            {t === 'all' ? 'Todos' : t === 'gasto' ? 'Gastos' : 'Receitas'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 4 }}>CATEGORIA</label>
                      <select className="input-field" value={fCat} onChange={e => setFCat(e.target.value)} style={{ width: '100%', fontSize: '0.8rem' }}>
                        <option value="all">Todas</option>
                        {cats.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 4 }}>VALOR MÍN</label>
                      <input className="input-field" type="number" value={fMin} onChange={e => setFMin(e.target.value)} placeholder="R$ 0" style={{ width: '100%', fontSize: '0.8rem' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 4 }}>VALOR MÁX</label>
                      <input className="input-field" type="number" value={fMax} onChange={e => setFMax(e.target.value)} placeholder="R$ 9999" style={{ width: '100%', fontSize: '0.8rem' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 4 }}>DATA INÍCIO</label>
                      <input className="input-field" type="date" value={fStart} onChange={e => setFStart(e.target.value)} style={{ width: '100%', fontSize: '0.8rem' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 4 }}>DATA FIM</label>
                      <input className="input-field" type="date" value={fEnd} onChange={e => setFEnd(e.target.value)} style={{ width: '100%', fontSize: '0.8rem' }} />
                    </div>
                    {activeFilters > 0 && (
                      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button className="btn-ghost" onClick={() => { setFType('all'); setFCat('all'); setFMin(''); setFMax(''); setFStart(''); setFEnd('') }} style={{ width: '100%', justifyContent: 'center' }}>
                          <X size={13} /> Limpar
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {filteredTx.length === 0 ? <Empty /> : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {filteredTx.map((t, i) => <TRow key={t.id} t={t} i={i} cartoes={cartoes} />)}
                    </div>
                    <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text2)' }}><strong style={{ color: 'var(--text)' }}>{filteredTx.length}</strong> transações</span>
                      <div style={{ display: 'flex', gap: 16, fontSize: '0.78rem' }}>
                        <span style={{ color: '#ef4444' }}>Gastos: <strong>{fmt(filteredTx.filter(t => t.tipo === 'gasto').reduce((a, t) => a + t.valor, 0))}</strong></span>
                        <span style={{ color: '#10b981' }}>Receitas: <strong>{fmt(filteredTx.filter(t => t.tipo === 'receita').reduce((a, t) => a + t.valor, 0))}</strong></span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ─── ANNUAL TAB ───────────────────────────────────────────── */}
            {tab === 'annual' && (
              <div>
                <div className="glass" style={{ padding: 24, marginBottom: 14 }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 18 }}>📅 Visão Anual — {year}</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={annualData} margin={{ bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} />
                      <Tooltip content={<CT />} />
                      <Legend formatter={v => <span style={{ color: '#94a3b8', fontSize: '0.76rem' }}>{v}</span>} />
                      <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="receitas" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="glass" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 14 }}>📊 Tabela Mensal</h3>
                  <div className="table-wrap" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {['Mês', 'Gastos', 'Receitas', 'Saldo'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Mês' ? 'left' : 'right', color: 'var(--text3)', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {annualData.map((row, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                            <td style={{ padding: '10px 12px', color: i === month ? '#a78bfa' : 'var(--text)', fontWeight: i === month ? 700 : 400 }}>{MONTHS_PT[i]}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{fmt(row.gastos)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: '#10b981', fontWeight: 600 }}>{fmt(row.receitas)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: row.saldo >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>{fmt(row.saldo)}</td>
                          </tr>
                        ))}
                        <tr style={{ borderTop: '2px solid var(--border)', background: 'rgba(99,102,241,0.06)' }}>
                          <td style={{ padding: '10px 12px', color: 'var(--text)', fontWeight: 700 }}>TOTAL</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#ef4444', fontWeight: 800 }}>{fmt(annualData.reduce((a, r) => a + r.gastos, 0))}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#10b981', fontWeight: 800 }}>{fmt(annualData.reduce((a, r) => a + r.receitas, 0))}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text)' }}>{fmt(annualData.reduce((a, r) => a + r.saldo, 0))}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ─── BUDGET TAB ───────────────────────────────────────────── */}
            {tab === 'budget' && (
              <div>

                {/* Parcelas Ativas */}
                {parcelasAtivas.length > 0 && (
                  <div className="glass" style={{ padding: 24, marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                      <span style={{ fontSize: '1rem' }}>💳</span>
                      <h3 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Parcelas Ativas — {year}</h3>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text3)', marginLeft: 'auto' }}>{parcelasAtivas.length} compra{parcelasAtivas.length > 1 ? 's' : ''} parcelada{parcelasAtivas.length > 1 ? 's' : ''}</span>
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
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>{p.categoria} · {fmt(p.valorParcela)}/parcela</span>
                                    {p.cartao_id && cartoes.find(c => c.id === p.cartao_id) && (
                                      <span style={{ fontSize: '0.67rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text2)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <CreditCard size={10} /> {cartoes.find(c => c.id === p.cartao_id)?.nome_cartao}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: done ? '#10b981' : '#f59e0b' }}>{done ? '✅ Quitado!' : `${restantes} restante${restantes > 1 ? 's' : ''}`}</div>
                                {!done && <div style={{ fontSize: '0.7rem', color: '#ef4444' }}>Ainda: {fmt(totalDevido)}</div>}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: done ? '#10b981' : `linear-gradient(90deg,#6366f1,#a78bfa)`, transition: 'width 0.5s ease' }} />
                              </div>
                              <span style={{ fontSize: '0.68rem', color: 'var(--text3)', minWidth: 55, textAlign: 'right' }}>{p.pagas}/{p.total} pagas</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>Total em parcelas restantes ({year}):</span>
                      <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ef4444' }}>{fmt(parcelasAtivas.reduce((a, p) => a + (p.total - p.pagas) * p.valorParcela, 0))}</span>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <Target size={16} color="#a78bfa" />
                  <span style={{ fontSize: '0.82rem', color: 'var(--text2)' }}>Defina metas de orçamento por categoria. Os dados são salvos no seu navegador.</span>
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
                                <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: over ? 'linear-gradient(90deg,#ef4444,#f87171)' : over ? '#f59e0b' : cc(cat), transition: 'width 0.5s ease' }} />
                              </div>
                              <div style={{ fontSize: '0.7rem', color: over ? '#ef4444' : 'var(--text3)', marginTop: 4, textAlign: 'right' }}>
                                {over ? `Excedeu ${fmt(spent - budget)}` : `Restam ${fmt(budget - spent)} (${(100 - pct).toFixed(0)}%)`}
                              </div>
                            </>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input type="number" value={editBudget[cat] ?? ''} onChange={e => setEditBudget(v => ({ ...v, [cat]: e.target.value }))}
                            placeholder="Defina meta R$" className="input-field" style={{ flex: 1, fontSize: '0.8rem', padding: '7px 10px' }} />
                          <button className="btn-primary" style={{ padding: '7px 12px', fontSize: '0.8rem' }} onClick={() => { saveBudget(cat, editBudget[cat] ?? ''); setEditBudget(v => ({ ...v, [cat]: '' })) }}>
                            Salvar
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ─── CARDS TAB ────────────────────────────────────────────── */}
            {tab === 'cards' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20, alignItems: 'start' }}>
                <div className="glass" style={{ padding: 24 }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 16 }}>Meus Cartões</h3>
                  {cartoes.length === 0 ? <Empty msg="Nenhum cartão cadastrado" /> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {cartoes.map((c, idx) => {
                        // Generate a pseudo-random harmonious color based on the card name
                        const hues = [250, 320, 200, 280, 150];
                        const hue = hues[c.nome_cartao.length % hues.length];
                        const bg1 = `hsl(${hue}, 60%, 25%)`;
                        const bg2 = `hsl(${hue + 30}, 60%, 15%)`;
                        const accent = `hsl(${hue + 15}, 80%, 65%)`;

                        return (
                          <div key={c.id} style={{
                            position: 'relative',
                            padding: '20px',
                            borderRadius: '16px',
                            background: `linear-gradient(135deg, ${bg1}, ${bg2})`,
                            boxShadow: '0 10px 30px -10px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            overflow: 'hidden',
                            minHeight: '140px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            color: 'white',
                            fontFamily: 'monospace'
                          }}>
                            {/* Decorative background circles */}
                            <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
                            <div style={{ position: 'absolute', bottom: -20, left: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'sans-serif' }}>
                                  {c.nome_cartao}
                                </div>
                                <div style={{ width: 36, height: 26, borderRadius: 4, background: 'linear-gradient(135deg, #d4af37 0%, #aa8000 100%)', opacity: 0.8, position: 'relative', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.2)' }}>
                                  {/* Fake chip lines */}
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
                              <div style={{ opacity: 0.8 }}>
                                <CreditCard size={28} />
                              </div>
                            </div>
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
                    Cadastre a data de fechamento e vencimento das suas faturas para receber avisos do automáticos no seu WhatsApp para não esquecer de pagar!
                  </p>

                  <form onSubmit={addCard} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 6 }}>NOME DO CARTÃO (Ex: Nubank)</label>
                      <input className="input-field" type="text" value={newCard.nome_cartao} onChange={e => setNewCard(v => ({ ...v, nome_cartao: e.target.value }))} placeholder="Nome do cartão" required style={{ width: '100%' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 6 }}>DIA FECHAMENTO</label>
                        <input className="input-field" type="number" min="1" max="31" value={newCard.dia_fechamento} onChange={e => setNewCard(v => ({ ...v, dia_fechamento: parseInt(e.target.value) || 1 }))} required style={{ width: '100%' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 6 }}>DIA VENCIMENTO</label>
                        <input className="input-field" type="number" min="1" max="31" value={newCard.dia_vencimento} onChange={e => setNewCard(v => ({ ...v, dia_vencimento: parseInt(e.target.value) || 1 }))} required style={{ width: '100%' }} />
                      </div>
                    </div>
                    <button type="submit" disabled={savingCard || !newCard.nome_cartao.trim()} className="btn-primary" style={{ marginTop: 8, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      {savingCard ? <RefreshCw size={16} className="animate-spin" /> : <>+</>}
                      Adicionar Cartão
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function MCard({ label, value, sub, icon, color, grad, pct, pctInvert, highlight }: { label: string; value: string; sub: string; icon: React.ReactNode; color: string; grad: string; pct?: number | null; pctInvert?: boolean; highlight?: boolean }) {
  const up = pct != null && pct >= 0
  const good = pctInvert ? !up : up
  return (
    <div className="glass" style={{ padding: 20, position: 'relative', overflow: 'hidden', ...(highlight ? { boxShadow: `0 0 40px ${color}22` } : {}) }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: 100, height: 100, background: grad, borderRadius: '50%', transform: 'translate(40%,-40%)', filter: 'blur(18px)' }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {pct != null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '2px 7px', borderRadius: 20, background: good ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', fontSize: '0.68rem', fontWeight: 700, color: good ? '#10b981' : '#ef4444' }}>
              {up ? <ChevronUp size={10} /> : <ChevronDown size={10} />}{Math.abs(pct)}%
            </span>
          )}
          <div style={{ padding: 7, borderRadius: 9, background: grad, color }}>{icon}</div>
        </div>
      </div>
      <div style={{ fontSize: 'var(--mcard-val, 1.35rem)', fontWeight: 800, color, lineHeight: 1.1, marginBottom: 5, letterSpacing: '-0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{sub}</div>
    </div>
  )
}

function ICard({ emoji, title, value, sub, color }: { emoji: string; title: string; value: string; sub: string; color: string }) {
  return (
    <div className="glass" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: '1.4rem', flexShrink: 0 }}>{emoji}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.65rem', color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
        <div style={{ fontSize: '0.7rem', color }}>{sub}</div>
      </div>
    </div>
  )
}

function TRow({ t, i, cartoes = [] }: { t: Transacao; i: number, cartoes?: Cartao[] }) {
  const isG = t.tipo === 'gasto'
  const col = isG ? '#ef4444' : '#10b981'
  const cartao = t.cartao_id ? cartoes.find(c => c.id === t.cartao_id) : null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', transition: 'all 0.15s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)' }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: `rgba(${h2r(cc(t.categoria))},0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: cc(t.categoria) }}>{ci(t.categoria)}</div>

      <div style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
        <div style={{ fontSize: '0.88rem', fontWeight: 600, wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 4 }}>{t.descricao}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: 20, background: `rgba(${h2r(cc(t.categoria))},0.12)`, color: cc(t.categoria), fontWeight: 600 }}>{t.categoria}</span>
          {cartao && (
            <span style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text3)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <CreditCard size={10} /> {cartao.nome_cartao}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: 5 }}>
        <div style={{ fontSize: '0.92rem', fontWeight: 700, color: col }}>{isG ? '-' : '+'}{fmt(t.valor)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: 0.85 }}>
          {isG ? <ArrowDownCircle size={11} color={col} /> : <ArrowUpCircle size={11} color={col} />}
          <span style={{ fontSize: '0.66rem', fontWeight: 600, color: 'var(--text3)' }}>{new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
        </div>
      </div>
    </div>
  )
}

function Empty({ msg = 'Nenhuma transação neste período' }: { msg?: string }) {
  return <div style={{ textAlign: 'center', padding: '40px 20px' }}><div style={{ fontSize: '2rem', marginBottom: 10 }}>📭</div><p style={{ color: 'var(--text2)', fontSize: '0.88rem' }}>{msg}</p></div>
}

// ─── Export ───────────────────────────────────────────────────────────────────
export default function Page() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)', flexDirection: 'column', gap: 14 }}><div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Wallet size={20} color="white" /></div><p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Carregando...</p></div>}>
      <Dashboard />
    </Suspense>
  )
}
