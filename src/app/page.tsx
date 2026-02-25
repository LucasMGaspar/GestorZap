'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { supabase, Transacao } from '@/lib/supabase'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line
} from 'recharts'
import {
  TrendingDown, TrendingUp, Wallet, ArrowDownCircle,
  ArrowUpCircle, Calendar, RefreshCw, MessageCircle
} from 'lucide-react'

const CATEGORY_COLORS: Record<string, string> = {
  'Alimentação': '#f59e0b',
  'Transporte': '#3b82f6',
  'Saúde': '#10b981',
  'Educação': '#8b5cf6',
  'Lazer': '#ec4899',
  'Moradia': '#f97316',
  'Roupas': '#06b6d4',
  'Assinaturas': '#6366f1',
  'Transferência': '#64748b',
  'Outros': '#94a3b8',
}

const MONTHS_PT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
]

function fmt(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function DashboardContent() {
  const searchParams = useSearchParams()
  const phoneParam = searchParams.get('phone') || ''

  const [phone, setPhone] = useState(phoneParam)
  const [inputPhone, setInputPhone] = useState(phoneParam)
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  const fetchData = useCallback(async () => {
    if (!phone) return
    setLoading(true)
    const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`
    const endDate = new Date(selectedYear, selectedMonth + 1, 0)
      .toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('transacoes')
      .select('*')
      .eq('phone', phone)
      .gte('data', startDate)
      .lte('data', endDate)
      .order('data', { ascending: false })

    if (!error && data) setTransacoes(data)
    setLoading(false)
  }, [phone, selectedMonth, selectedYear])

  useEffect(() => { fetchData() }, [fetchData])

  const gastos = transacoes.filter(t => t.tipo === 'gasto')
  const receitas = transacoes.filter(t => t.tipo === 'receita')
  const totalGastos = gastos.reduce((acc, t) => acc + t.valor, 0)
  const totalReceitas = receitas.reduce((acc, t) => acc + t.valor, 0)
  const saldo = totalReceitas - totalGastos

  // Por categoria para pizza
  const categoriaMap: Record<string, number> = {}
  gastos.forEach(t => {
    categoriaMap[t.categoria] = (categoriaMap[t.categoria] || 0) + t.valor
  })
  const pieData = Object.entries(categoriaMap).map(([name, value]) => ({ name, value }))

  // Por dia para linha
  const dailyMap: Record<string, { gastos: number; receitas: number }> = {}
  transacoes.forEach(t => {
    if (!dailyMap[t.data]) dailyMap[t.data] = { gastos: 0, receitas: 0 }
    if (t.tipo === 'gasto') dailyMap[t.data].gastos += t.valor
    else dailyMap[t.data].receitas += t.valor
  })
  const lineData = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, vals]) => ({ data: data.split('-')[2], ...vals }))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'linear-gradient(135deg, #6c63ff, #22d3ee)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Wallet size={22} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>Gestor Financeiro</h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Dashboard pessoal via WhatsApp</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Phone input */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={inputPhone}
              onChange={e => setInputPhone(e.target.value)}
              placeholder="55119999..."
              style={{ padding: '8px 14px', borderRadius: '10px', background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--text)', fontSize: '0.85rem', width: '160px' }}
            />
            <button
              onClick={() => setPhone(inputPhone)}
              style={{ padding: '8px 16px', borderRadius: '10px', background: 'linear-gradient(135deg, #6c63ff, #22d3ee)', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
            >
              Buscar
            </button>
          </div>

          {/* Month selector */}
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            style={{ padding: '8px 12px', borderRadius: '10px', background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--text)', fontSize: '0.85rem' }}
          >
            {MONTHS_PT.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>

          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            style={{ padding: '8px 12px', borderRadius: '10px', background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--text)', fontSize: '0.85rem' }}
          >
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <button
            onClick={fetchData}
            disabled={loading}
            style={{ padding: '8px 12px', borderRadius: '10px', background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Carregando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {!phone ? (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <MessageCircle size={64} color="var(--muted)" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ color: 'var(--muted)', fontSize: '1.2rem' }}>Digite seu número de WhatsApp para ver o dashboard</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '8px' }}>Ex: 5511999999999</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <SummaryCard icon={<ArrowDownCircle size={20} color="#ef4444" />} label="Total Gastos" value={fmt(totalGastos)} color="#ef4444" sub={`${gastos.length} transações`} />
            <SummaryCard icon={<ArrowUpCircle size={20} color="#10b981" />} label="Total Receitas" value={fmt(totalReceitas)} color="#10b981" sub={`${receitas.length} transações`} />
            <SummaryCard
              icon={saldo >= 0 ? <TrendingUp size={20} color="#10b981" /> : <TrendingDown size={20} color="#ef4444" />}
              label="Saldo" value={fmt(saldo)} color={saldo >= 0 ? '#10b981' : '#ef4444'}
              sub={saldo >= 0 ? 'Positivo ✨' : 'Atenção ⚠️'}
            />
            <SummaryCard icon={<Calendar size={20} color="#6c63ff" />} label="Mês" value={`${MONTHS_PT[selectedMonth]}/${selectedYear}`} color="#6c63ff" sub={`${transacoes.length} registros`} />
          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            {/* Pie Chart - Gastos por categoria */}
            <div className="glass" style={{ padding: '24px' }}>
              <h3 style={{ marginBottom: '20px', fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>💸 Gastos por Categoria</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={CATEGORY_COLORS[entry.name] || '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <EmptyState />}
            </div>

            {/* Line Chart - Evolução diária */}
            <div className="glass" style={{ padding: '24px' }}>
              <h3 style={{ marginBottom: '20px', fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>📈 Evolução Diária</h3>
              {lineData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
                    <XAxis dataKey="data" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => `R$${v}`} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="gastos" stroke="#ef4444" strokeWidth={2} dot={false} name="Gastos" />
                    <Line type="monotone" dataKey="receitas" stroke="#10b981" strokeWidth={2} dot={false} name="Receitas" />
                  </LineChart>
                </ResponsiveContainer>
              ) : <EmptyState />}
            </div>
          </div>

          {/* Bar chart - categorias */}
          {pieData.length > 0 && (
            <div className="glass" style={{ padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ marginBottom: '20px', fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>📊 Ranking por Categoria</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={pieData.sort((a, b) => b.value - a.value)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => `R$${v}`} />
                  <YAxis dataKey="name" type="category" tick={{ fill: '#64748b', fontSize: 11 }} width={90} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[entry.name] || '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Transaction List */}
          <div className="glass" style={{ padding: '24px' }}>
            <h3 style={{ marginBottom: '20px', fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>🧾 Últimas Transações</h3>
            {transacoes.length === 0 ? (
              <EmptyState message="Nenhuma transação neste período" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {transacoes.map(t => (
                  <TransactionRow key={t.id} t={t} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

function SummaryCard({ icon, label, value, color, sub }: { icon: React.ReactNode; label: string; value: string; color: string; sub: string }) {
  return (
    <div className="glass" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <div style={{ padding: '8px', borderRadius: '10px', background: `${color}18` }}>{icon}</div>
      </div>
      <div>
        <div style={{ fontSize: '1.6rem', fontWeight: 700, color }}>{value}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '4px' }}>{sub}</div>
      </div>
    </div>
  )
}

function TransactionRow({ t }: { t: Transacao }) {
  const isGasto = t.tipo === 'gasto'
  const color = isGasto ? '#ef4444' : '#10b981'
  const catColor = CATEGORY_COLORS[t.categoria] || '#94a3b8'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)' }}>
      <div style={{ width: 36, height: 36, borderRadius: '10px', background: `${catColor}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {isGasto ? <ArrowDownCircle size={18} color={catColor} /> : <ArrowUpCircle size={18} color="#10b981" />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.descricao}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '2px' }}>
          <span style={{ padding: '2px 8px', borderRadius: '20px', background: `${catColor}18`, color: catColor, fontWeight: 500 }}>{t.categoria}</span>
          <span style={{ marginLeft: '8px' }}>{new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
        </div>
      </div>
      <div style={{ fontSize: '1rem', fontWeight: 700, color, flexShrink: 0 }}>
        {isGasto ? '-' : '+'}{fmt(t.valor)}
      </div>
    </div>
  )
}

function EmptyState({ message = 'Nenhum dado disponível' }: { message?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
      <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📭</div>
      <p style={{ fontSize: '0.9rem' }}>{message}</p>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--muted)' }}>Carregando...</div>}>
      <DashboardContent />
    </Suspense>
  )
}
