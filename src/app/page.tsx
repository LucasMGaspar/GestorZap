'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSupabase, Transacao } from '@/lib/supabase'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, Legend
} from 'recharts'
import {
  TrendingDown, TrendingUp, Wallet, ArrowDownCircle,
  ArrowUpCircle, Calendar, RefreshCw, MessageCircle,
  ShoppingCart, Car, Heart, BookOpen, Gamepad2, Home,
  Shirt, CreditCard, ArrowLeftRight, MoreHorizontal,
  AlertCircle, ChevronDown, BarChart2, Search
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const CATEGORY_CONFIG: Record<string, { color: string; icon: React.ReactNode; gradient: string }> = {
  'Alimentação': { color: '#f59e0b', icon: <ShoppingCart size={14} />, gradient: 'rgba(245,158,11,0.15)' },
  'Transporte': { color: '#3b82f6', icon: <Car size={14} />, gradient: 'rgba(59,130,246,0.15)' },
  'Saúde': { color: '#10b981', icon: <Heart size={14} />, gradient: 'rgba(16,185,129,0.15)' },
  'Educação': { color: '#8b5cf6', icon: <BookOpen size={14} />, gradient: 'rgba(139,92,246,0.15)' },
  'Lazer': { color: '#ec4899', icon: <Gamepad2 size={14} />, gradient: 'rgba(236,72,153,0.15)' },
  'Moradia': { color: '#f97316', icon: <Home size={14} />, gradient: 'rgba(249,115,22,0.15)' },
  'Roupas': { color: '#06b6d4', icon: <Shirt size={14} />, gradient: 'rgba(6,182,212,0.15)' },
  'Assinaturas': { color: '#6366f1', icon: <CreditCard size={14} />, gradient: 'rgba(99,102,241,0.15)' },
  'Transferência': { color: '#64748b', icon: <ArrowLeftRight size={14} />, gradient: 'rgba(100,116,139,0.15)' },
  'Outros': { color: '#94a3b8', icon: <MoreHorizontal size={14} />, gradient: 'rgba(148,163,184,0.15)' },
}

function catColor(cat: string) { return CATEGORY_CONFIG[cat]?.color || '#94a3b8' }
function catIcon(cat: string) { return CATEGORY_CONFIG[cat]?.icon ?? <MoreHorizontal size={14} /> }

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─── Custom Tooltip ────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0d1220', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px 16px', boxShadow: '0 16px 40px rgba(0,0,0,0.4)' }}>
      {label && <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '8px', fontWeight: 500 }}>{label}</p>}
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ color: '#94a3b8' }}>{p.name}:</span>
          <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{fmt(p.value ?? 0)}</span>
        </div>
      ))}
    </div>
  )
}

const PieTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) => {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div style={{ background: '#0d1220', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px 16px', boxShadow: '0 16px 40px rgba(0,0,0,0.4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: catColor(p.name), flexShrink: 0 }} />
        <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{p.name}</span>
      </div>
      <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1rem', marginTop: '4px' }}>{fmt(p.value ?? 0)}</div>
    </div>
  )
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────

function DashboardContent() {
  const searchParams = useSearchParams()
  const [phone, setPhone] = useState(searchParams.get('phone') || '')
  const [inputPhone, setInputPhone] = useState(searchParams.get('phone') || '')
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions'>('overview')
  const [searchTx, setSearchTx] = useState('')

  const fetchData = useCallback(async () => {
    if (!phone) return
    const client = getSupabase()
    if (!client) return
    setLoading(true)
    const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`
    const endDate = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split('T')[0]
    const { data, error } = await client
      .from('transacoes').select('*').eq('phone', phone)
      .gte('data', startDate).lte('data', endDate)
      .order('data', { ascending: false })
    if (!error && data) setTransacoes(data)
    setLoading(false)
  }, [phone, selectedMonth, selectedYear])

  useEffect(() => { fetchData() }, [fetchData])

  // ─── Derived data
  const gastos = transacoes.filter(t => t.tipo === 'gasto')
  const receitas = transacoes.filter(t => t.tipo === 'receita')
  const totalGastos = gastos.reduce((a, t) => a + t.valor, 0)
  const totalReceitas = receitas.reduce((a, t) => a + t.valor, 0)
  const saldo = totalReceitas - totalGastos
  const txRate = transacoes.length > 0 ? (gastos.length / transacoes.length * 100).toFixed(0) : '0'

  const categoriaMap: Record<string, number> = {}
  gastos.forEach(t => { categoriaMap[t.categoria] = (categoriaMap[t.categoria] || 0) + t.valor })
  const pieData = Object.entries(categoriaMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))

  const dailyMap: Record<string, { gastos: number; receitas: number }> = {}
  transacoes.forEach(t => {
    if (!dailyMap[t.data]) dailyMap[t.data] = { gastos: 0, receitas: 0 }
    if (t.tipo === 'gasto') dailyMap[t.data].gastos += t.valor
    else dailyMap[t.data].receitas += t.valor
  })
  const areaData = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, v]) => ({ dia: data.split('-')[2], ...v }))

  const topCateg = pieData[0]
  const maiorGasto = gastos.reduce<Transacao | null>((max, t) => !max || t.valor > max.valor ? t : max, null)
  const mediaGasto = gastos.length ? totalGastos / gastos.length : 0

  const filteredTx = transacoes.filter(t =>
    t.descricao?.toLowerCase().includes(searchTx.toLowerCase()) ||
    t.categoria?.toLowerCase().includes(searchTx.toLowerCase())
  )

  const years = [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1]

  // ─── Layout
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '0' }}>
      {/* Background decoration */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '60%', height: '60%', background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '60%', height: '60%', background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)', borderRadius: '50%' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '1280px', margin: '0 auto', padding: '28px 24px' }}>

        {/* ─── Header */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: 48, height: 48, borderRadius: '14px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(99,102,241,0.4)' }}>
              <Wallet size={22} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, background: 'linear-gradient(135deg, #f1f5f9, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Gestor Financeiro
              </h1>
              <p style={{ fontSize: '0.78rem', color: 'var(--text2)', marginTop: '1px' }}>Dashboard pessoal via WhatsApp</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input className="input-field" value={inputPhone} onChange={e => setInputPhone(e.target.value)}
                placeholder="55119999..." style={{ width: '150px' }}
                onKeyDown={e => e.key === 'Enter' && setPhone(inputPhone)} />
              <button className="btn-primary" onClick={() => setPhone(inputPhone)}>Buscar</button>
            </div>
            <select className="input-field" value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
              {MONTHS_SHORT.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select className="input-field" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button className="btn-ghost" onClick={fetchData} disabled={loading}>
              <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              {loading ? 'Carregando...' : 'Atualizar'}
            </button>
          </div>
        </header>

        {/* ─── Empty state */}
        {!phone ? (
          <div style={{ textAlign: 'center', padding: '100px 20px' }}>
            <div style={{ width: 80, height: 80, borderRadius: '24px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <MessageCircle size={36} color="#6366f1" />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>Bem-vindo ao seu Dashboard</h2>
            <p style={{ color: 'var(--text2)', fontSize: '0.95rem' }}>Digite seu número de WhatsApp acima para visualizar seus dados</p>
            <p style={{ color: 'var(--text3)', fontSize: '0.82rem', marginTop: '6px' }}>Ex: 5511999999999</p>
          </div>
        ) : (
          <div style={{ animation: 'fadeUp 0.4s ease' }}>

            {/* Month banner */}
            <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '20px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <Calendar size={13} color="#a78bfa" />
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#a78bfa' }}>{MONTHS_PT[selectedMonth]} {selectedYear}</span>
              </div>
              <span style={{ color: 'var(--text3)', fontSize: '0.82rem' }}>{transacoes.length} transações registradas</span>
            </div>

            {/* ─── Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <MetricCard label="Total Gastos" value={fmt(totalGastos)} sub={`${gastos.length} transações`}
                icon={<ArrowDownCircle size={20} />} color="#ef4444" gradient="rgba(239,68,68,0.1)" accent="#ef4444" />
              <MetricCard label="Total Receitas" value={fmt(totalReceitas)} sub={`${receitas.length} transações`}
                icon={<ArrowUpCircle size={20} />} color="#10b981" gradient="rgba(16,185,129,0.1)" accent="#10b981" />
              <MetricCard label="Saldo Atual" value={fmt(saldo)} sub={saldo >= 0 ? 'Em dia ✨' : 'Atenção ⚠️'}
                icon={saldo >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                color={saldo >= 0 ? '#10b981' : '#ef4444'} gradient={saldo >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}
                accent={saldo >= 0 ? '#10b981' : '#ef4444'} highlight />
              <MetricCard label="Gasto Médio" value={fmt(mediaGasto)} sub="por transação"
                icon={<BarChart2 size={20} />} color="#6366f1" gradient="rgba(99,102,241,0.1)" accent="#6366f1" />
            </div>

            {/* ─── Insights row */}
            {transacoes.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                {topCateg && (
                  <InsightCard emoji="🏆" title="Maior categoria" value={topCateg.name} sub={fmt(topCateg.value)} color={catColor(topCateg.name)} />
                )}
                {maiorGasto && (
                  <InsightCard emoji="📌" title="Maior gasto" value={maiorGasto.descricao} sub={fmt(maiorGasto.valor)} color="#f59e0b" />
                )}
                <InsightCard emoji="📊" title="Taxa de gastos" value={`${txRate}%`} sub={`das ${transacoes.length} transações`} color="#8b5cf6" />
                <InsightCard emoji="💳" title="Categorias" value={`${pieData.length}`} sub="categorias de gasto" color="#3b82f6" />
              </div>
            )}

            {/* ─── Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '12px', width: 'fit-content', border: '1px solid var(--border)' }}>
              {(['overview', 'transactions'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '8px 18px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.2s',
                    background: activeTab === tab ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
                    color: activeTab === tab ? 'white' : '#94a3b8'
                  }}>
                  {tab === 'overview' ? '📊 Visão Geral' : '🧾 Transações'}
                </button>
              ))}
            </div>

            {/* ─── Overview Tab */}
            {activeTab === 'overview' && (
              <div>
                {transacoes.length === 0 ? (
                  <EmptyState message="Nenhuma transação neste período" />
                ) : (
                  <>
                    {/* Charts row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                      {/* Area chart */}
                      <div className="glass" style={{ padding: '24px' }}>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '20px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1rem' }}>📈</span> Evolução Diária
                        </h3>
                        <ResponsiveContainer width="100%" height={240}>
                          <AreaChart data={areaData}>
                            <defs>
                              <linearGradient id="gGastos" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="gReceitas" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="dia" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend formatter={v => <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{v}</span>} />
                            <Area type="monotone" dataKey="gastos" stroke="#ef4444" strokeWidth={2} fill="url(#gGastos)" name="Gastos" dot={false} />
                            <Area type="monotone" dataKey="receitas" stroke="#10b981" strokeWidth={2} fill="url(#gReceitas)" name="Receitas" dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Pie chart */}
                      <div className="glass" style={{ padding: '24px' }}>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '20px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1rem' }}>💸</span> Gastos por Categoria
                        </h3>
                        {pieData.length > 0 ? (
                          <>
                            <ResponsiveContainer width="100%" height={180}>
                              <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                                  {pieData.map((entry, i) => (
                                    <Cell key={i} fill={catColor(entry.name)} stroke="transparent" />
                                  ))}
                                </Pie>
                                <Tooltip content={<PieTooltip />} />
                              </PieChart>
                            </ResponsiveContainer>
                            {/* Legend */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                              {pieData.slice(0, 5).map((e, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: catColor(e.name), flexShrink: 0 }} />
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text2)' }}>{e.name}</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '80px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${(e.value / totalGastos * 100)}%`, background: catColor(e.name), borderRadius: '2px', transition: 'width 0.6s ease' }} />
                                    </div>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', minWidth: '70px', textAlign: 'right' }}>{fmt(e.value)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : <EmptyState message="Nenhum gasto registrado" />}
                      </div>
                    </div>

                    {/* Bar chart */}
                    {pieData.length > 0 && (
                      <div className="glass" style={{ padding: '24px' }}>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '20px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1rem' }}>🏅</span> Ranking por Categoria
                        </h3>
                        <ResponsiveContainer width="100%" height={Math.max(160, pieData.length * 44)}>
                          <BarChart data={pieData} layout="vertical" margin={{ left: 0, right: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                            <XAxis type="number" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} />
                            <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 12 }} width={100} axisLine={false} tickLine={false} />
                            <Tooltip content={<PieTooltip />} />
                            <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                              {pieData.map((entry, i) => (
                                <Cell key={i} fill={catColor(entry.name)} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ─── Transactions Tab */}
            {activeTab === 'transactions' && (
              <div className="glass" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1rem' }}>🧾</span> Transações — {MONTHS_PT[selectedMonth]}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
                    <Search size={14} color="#94a3b8" />
                    <input value={searchTx} onChange={e => setSearchTx(e.target.value)}
                      placeholder="Buscar transação..." style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: '0.85rem', fontFamily: 'inherit', width: '180px' }} />
                  </div>
                </div>

                {filteredTx.length === 0 ? (
                  <EmptyState message={searchTx ? 'Nenhuma transação encontrada' : 'Nenhuma transação neste período'} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {filteredTx.map((t, i) => (
                      <TransactionRow key={t.id} t={t} index={i} />
                    ))}
                  </div>
                )}

                {/* Summary footer */}
                {filteredTx.length > 0 && (
                  <div style={{ marginTop: '20px', padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text2)' }}>
                      Mostrando <strong style={{ color: 'var(--text)' }}>{filteredTx.length}</strong> transações
                    </div>
                    <div style={{ display: 'flex', gap: '20px', fontSize: '0.82rem' }}>
                      <span style={{ color: '#ef4444' }}>Gastos: <strong>{fmt(filteredTx.filter(t => t.tipo === 'gasto').reduce((a, t) => a + t.valor, 0))}</strong></span>
                      <span style={{ color: '#10b981' }}>Receitas: <strong>{fmt(filteredTx.filter(t => t.tipo === 'receita').reduce((a, t) => a + t.valor, 0))}</strong></span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, icon, color, gradient, accent, highlight }: {
  label: string; value: string; sub: string; icon: React.ReactNode;
  color: string; gradient: string; accent: string; highlight?: boolean
}) {
  return (
    <div className="glass" style={{ padding: '22px', position: 'relative', overflow: 'hidden', ...(highlight ? { boxShadow: `0 0 40px ${accent}22` } : {}) }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: '120px', height: '120px', background: gradient, borderRadius: '50%', transform: 'translate(40%, -40%)', filter: 'blur(20px)' }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
        <div style={{ padding: '8px', borderRadius: '10px', background: gradient, color }}>{icon}</div>
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: 800, color, lineHeight: 1, marginBottom: '6px' }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>{sub}</div>
    </div>
  )
}

function InsightCard({ emoji, title, value, sub, color }: { emoji: string; title: string; value: string; sub: string; color: string }) {
  return (
    <div className="glass" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
      <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>{emoji}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>{title}</div>
        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
        <div style={{ fontSize: '0.72rem', color }}>{sub}</div>
      </div>
    </div>
  )
}

function TransactionRow({ t, index }: { t: Transacao; index: number }) {
  const isGasto = t.tipo === 'gasto'
  const color = isGasto ? '#ef4444' : '#10b981'
  const bg = isGasto ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)'
  const catC = catColor(t.categoria)
  const icon = catIcon(t.categoria)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderRadius: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', transition: 'all 0.2s', cursor: 'default', animationDelay: `${index * 30}ms` }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}>

      {/* Category icon */}
      <div style={{ width: 40, height: 40, borderRadius: '12px', background: `rgba(${catC.startsWith('#') ? hexToRgb(catC) : catC},0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: catC }}>
        {icon}
      </div>

      {/* Details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.descricao}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '20px', background: `rgba(${catC.startsWith('#') ? hexToRgb(catC) : catC},0.12)`, color: catC, fontSize: '0.68rem', fontWeight: 600 }}>
            {icon} {t.categoria}
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
        </div>
      </div>

      {/* Type badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', background: bg }}>
        {isGasto ? <ArrowDownCircle size={12} color={color} /> : <ArrowUpCircle size={12} color={color} />}
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color }}>{isGasto ? 'Gasto' : 'Receita'}</span>
      </div>

      {/* Value */}
      <div style={{ fontSize: '1rem', fontWeight: 700, color, minWidth: '100px', textAlign: 'right' }}>
        {isGasto ? '-' : '+'}{fmt(t.valor)}
      </div>
    </div>
  )
}

function EmptyState({ message = 'Nenhum dado disponível' }: { message?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📭</div>
      <p style={{ color: 'var(--text2)', fontSize: '0.92rem' }}>{message}</p>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function Page() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: 48, height: 48, borderRadius: '14px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Wallet size={22} color="white" />
        </div>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Carregando dashboard...</p>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
