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
  Download, Target, ChevronUp, ChevronDown, AlertTriangle, Zap, Filter, X, Edit3
} from 'lucide-react'

import { Empty } from '@/components/Empty'
import { ICard } from '@/components/ICard'
import { MCard } from '@/components/MCard'
import { TRow } from '@/components/TRow'
import { MONTHS_PT, MONTHS_S, WEEK_DAYS, CAT, cc, ci, fmt, h2r } from '@/lib/utils'

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
  const [txAll, setTxAll] = useState<Transacao[]>([])       // por ciclo de fatura
  const [txPrev, setTxPrev] = useState<Transacao[]>([])
  const [txYear, setTxYear] = useState<Transacao[]>([])
  const [comprasParceladas, setComprasParceladas] = useState<CompraParcelada[]>([])
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [loading, setLoading] = useState(false)
  const [pagandoFatura, setPagandoFatura] = useState<string | null>(null) // cartao_id sendo pago
  const [paidTxIds, setPaidTxIds] = useState<Set<string>>(new Set())
  const [month, setMonth] = useState(new Date().getMonth())
  const [year, setYear] = useState(new Date().getFullYear())
  const [tab, setTab] = useState<'transactions' | 'cards' | 'budget' | 'annual' | 'overview'>('transactions')
  // Filters
  const [fType, setFType] = useState<'all' | 'gasto' | 'receita' | 'parcela'>('all')
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

  // Edit Transaction
  const [editingTx, setEditingTx] = useState<Transacao | null>(null)
  const [editingTxOriginalData, setEditingTxOriginalData] = useState<string>('')
  const [savingTx, setSavingTx] = useState(false)

  // Load budgets
  useEffect(() => { try { const b = localStorage.getItem('fin_budgets'); if (b) setBudgets(JSON.parse(b)) } catch { } }, [])
  // Load paid fatura tx IDs
  useEffect(() => { try { const p = localStorage.getItem('fin_paid_tx_ids'); if (p) setPaidTxIds(new Set(JSON.parse(p))) } catch { } }, [])
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

      // Step 2: Calculate date ranges
      const pmMonth = month === 0 ? 11 : month - 1
      const pmYear = month === 0 ? year - 1 : year

      const prevPmMonth = pmMonth === 0 ? 11 : pmMonth - 1
      const prevPmYear = pmMonth === 0 ? pmYear - 1 : pmYear

      const [pm, py] = [pmMonth, pmYear]

      // Get data for the current month view. Since credit cards bill usually close before the month ends,
      // a purchase made late in the PREVIOUS month might belong to the CURRENT month's bill.
      // E.g: February 25th purchase on a card that closes on the 20th belongs to the March bill.
      // So we need to fetch since the 1st day of the previous month to be safe.
      const s = `${pmYear}-${String(pmMonth + 1).padStart(2, '0')}-01`
      const e = new Date(year, month + 1, 0).toISOString().split('T')[0]

      const ps = `${prevPmYear}-${String(prevPmMonth + 1).padStart(2, '0')}-01`
      const pe = new Date(py, pm + 1, 0).toISOString().split('T')[0]

      const ys = `${year}-01-01`, ye = `${year}-12-31`
      const [r1, r2, r3, r4, r5] = await Promise.all([
        client.from('transacoes').select('*').eq('phone', resolvedPhone).gte('data', s).lte('data', e).order('data', { ascending: false }),
        client.from('transacoes').select('*').eq('phone', resolvedPhone).gte('data', ps).lte('data', pe),
        client.from('transacoes').select('*').eq('phone', resolvedPhone).gte('data', ys).lte('data', ye),
        client.from('compras_parceladas').select('*').eq('phone', resolvedPhone).eq('ativa', true).order('criado_em', { ascending: false }),
        client.from('cartoes').select('*').eq('phone', resolvedPhone).order('nome_cartao', { ascending: true })
      ])

      const fetchedCards = r5.data ?? []

      // Help function to determine which MONTH (0-11) and YEAR a specific transaction truly belongs to
      const getRealMonthYear = (t: Transacao, cards: Cartao[]) => {
        const txDate = new Date(t.data + 'T12:00:00')
        const txMo = txDate.getMonth()
        const txYr = txDate.getFullYear()

        if (t.tipo !== 'gasto' || !t.cartao_id) return { m: txMo, y: txYr } // PIX, Debit, Income, Installment => pure competence/date

        const card = cards.find(c => c.id === t.cartao_id)
        if (!card) return { m: txMo, y: txYr }

        // It's a credit card expense
        // If purchase day >= closing day, it jumps to the NEXT month's bill
        const buyDay = txDate.getDate()
        let targetMo = txMo
        let targetYr = txYr

        if (buyDay >= card.dia_fechamento) {
          targetMo += 1
          if (targetMo > 11) {
            targetMo = 0
            targetYr += 1
          }
        }
        return { m: targetMo, y: targetYr }
      }

      // Lista e cards: por ciclo de fatura (pizza comprada no dia do fechamento vai pro próximo mês)
      const processTxByCycle = (txs: Transacao[]) => {
        return txs.filter(t => {
          const target = getRealMonthYear(t, fetchedCards)
          return target.m === month && target.y === year
        })
      }

      // Mês anterior: por ciclo de fatura (para comparação %)
      const processPrevTx = (txs: Transacao[]) => {
        return txs.filter(t => {
          const target = getRealMonthYear(t, fetchedCards)
          return target.m === pm && target.y === py
        })
      }

      if (r1.data) setTxAll(processTxByCycle(r1.data))
      if (r2.data) setTxPrev(processPrevTx(r2.data))
      if (r3.data) setTxYear(r3.data) // We leave annual raw to handle natively inside its own useMemo later
      setComprasParceladas(r4.data ?? [])
      setCartoes(fetchedCards)
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
      const { error } = await client.from('cartoes').delete().eq('id', id)
      if (error) {
        alert('Não foi possível excluir. Este cartão possui transações vinculadas.')
        return
      }
      setCartoes(prev => prev.filter(c => c.id !== id))
    }
  }

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTx) return
    setSavingTx(true)
    const client = getSupabase()
    if (client) {
      const { data, error } = await client.from('transacoes').update({
        descricao: editingTx.descricao,
        valor: editingTx.valor,
        categoria: editingTx.categoria,
        data: editingTx.data,
      }).eq('id', editingTx.id).select().single()

      if (data && !error) {
        if (editingTx.tipo === 'parcela' && editingTx.compra_parcelada_id) {
          await client.from('faturas').update({
            valor: data.valor,
            descricao: data.descricao,
            vencimento: data.data,
          }).eq('compra_parcelada_id', editingTx.compra_parcelada_id)
            .eq('vencimento', editingTxOriginalData)
        }
        setTxAll(prev => prev.map(t => t.id === data.id ? data : t))
        setEditingTx(null)
      } else {
        alert("Erro ao salvar a edição. Tente novamente.")
      }
    }
    setSavingTx(false)
  }

  const pagarFatura = async (cartaoId: string, itens: Transacao[]) => {
    const cartao = cartoes.find(c => c.id === cartaoId)
    const total = itens.reduce((a, t) => a + t.valor, 0)
    if (!confirm(`Confirmar pagamento da fatura ${cartao?.nome_cartao} de ${fmt(total)}?\n\nUma transação PIX/débito será criada no valor total.`)) return
    setPagandoFatura(cartaoId)
    const client = getSupabase()
    if (client) {
      const diaVenc = cartao?.dia_vencimento || 1
      const hoje = `${year}-${String(month + 1).padStart(2, '0')}-${String(diaVenc).padStart(2, '0')}`
      // 1. Registrar pagamento como PIX/débito (sai do banco)
      await client.from('transacoes').insert({
        phone, tipo: 'gasto', valor: total,
        categoria: 'Transferência',
        descricao: `Pagamento fatura ${cartao?.nome_cartao}`,
        data: hoje, cartao_id: null,
        criado_em: new Date().toISOString()
      })
      // 2. Marcar faturas das parcelas como pagas
      const parcelas = itens.filter(t => t.tipo === 'parcela' && t.compra_parcelada_id)
      for (const p of parcelas) {
        await client.from('faturas').update({ status: 'pago' })
          .eq('compra_parcelada_id', p.compra_parcelada_id!)
          .eq('vencimento', p.data)
      }
      // 3. Marcar IDs dos itens como pagos (persiste no localStorage)
      const newPaidIds = new Set([...paidTxIds, ...itens.map(i => i.id)])
      setPaidTxIds(newPaidIds)
      try { localStorage.setItem('fin_paid_tx_ids', JSON.stringify([...newPaidIds])) } catch {}
      await fetchData()
    }
    setPagandoFatura(null)
  }

  // ─── Derived ──────────────────────────────────────────────────────────────
  // Separação por método de pagamento (todos por ciclo de fatura)
  const gastosDebit    = txAll.filter(t => t.tipo === 'gasto' && !t.cartao_id)
  const gastosCredit   = txAll.filter(t => t.tipo === 'gasto' && !!t.cartao_id && !paidTxIds.has(t.id))
  const parcelasCartao = txAll.filter(t => t.tipo === 'parcela' && !!t.cartao_id && !paidTxIds.has(t.id))
  const parcelasDebito = txAll.filter(t => t.tipo === 'parcela' && !t.cartao_id)
  const receitas       = txAll.filter(t => t.tipo === 'receita')

  const totalDebit      = gastosDebit.reduce((a, t) => a + t.valor, 0)
  const totalParcDebito = parcelasDebito.reduce((a, t) => a + t.valor, 0)
  // Modelo caixa: Total Gastos = só o que sai do banco (débito/PIX + financiamentos sem cartão)
  const totalG = totalDebit + totalParcDebito
  const totalR = receitas.reduce((a, t) => a + t.valor, 0)
  // Fatura = crédito avulso + parcelas no cartão do ciclo deste mês
  const totalCredit = gastosCredit.reduce((a, t) => a + t.valor, 0) + parcelasCartao.reduce((a, t) => a + t.valor, 0)

  // Saldo real = receitas menos o que efetivamente saiu do banco (exclui crédito)
  const saldoReal = totalR - totalDebit - totalParcDebito
  const saldo = totalR - totalG - totalCredit // comprometido (inclui fatura pendente)

  const pGastos = txPrev.filter(t => (t.tipo === 'gasto' && !t.cartao_id) || (t.tipo === 'parcela' && !t.cartao_id)).reduce((a, t) => a + t.valor, 0)
  const pReceitas = txPrev.filter(t => t.tipo === 'receita').reduce((a, t) => a + t.valor, 0)
  const pct = (now: number, prev: number) => prev === 0 ? null : Math.round((now - prev) / prev * 100)
  const pctG = pct(totalG, pGastos), pctR = pct(totalR, pReceitas)

  // Category map — inclui todos os gastos/parcelas para visão de onde gastou
  const catMap = useMemo(() => {
    const m: Record<string, number> = {}
    txAll.filter(t => t.tipo === 'gasto' || t.tipo === 'parcela')
      .forEach(t => { m[t.categoria] = (m[t.categoria] || 0) + t.valor })
    return m
  }, [txAll])
  const pieData = Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))

  // Daily map — parcelas tratadas como gasto (competência)
  const areaData = useMemo(() => {
    const m: Record<string, { gastos: number; receitas: number; acumulado?: number }> = {}
    txAll.forEach(t => {
      if (!m[t.data]) m[t.data] = { gastos: 0, receitas: 0 }
      if (t.tipo === 'gasto' || t.tipo === 'parcela') m[t.data].gastos += t.valor
      else if (t.tipo === 'receita') m[t.data].receitas += t.valor
    })
    let acc = 0
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b)).map(([data, v]) => {
      acc += v.receitas - v.gastos
      return { dia: data.split('-')[2], gastos: v.gastos, receitas: v.receitas, acumulado: acc }
    })
  }, [txAll])

  // Forecast — só faz sentido para o mês atual
  const _today = new Date()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const isCurrentMonthYear = month === _today.getMonth() && year === _today.getFullYear()
  const today = isCurrentMonthYear ? _today.getDate() : daysInMonth
  const avgDailySpend = today > 0 ? totalG / today : 0
  const forecastTotal = isCurrentMonthYear ? avgDailySpend * daysInMonth : totalG
  const forecastRemaining = forecastTotal - totalG

  // Day-of-week heatmap — inclui parcelas
  const dowData = useMemo(() => {
    const m = Array(7).fill(0)
    txAll.filter(t => t.tipo === 'gasto' || t.tipo === 'parcela')
      .forEach(t => { const d = new Date(t.data + 'T12:00:00'); m[d.getDay()] += t.valor })
    const max = Math.max(...m, 1)
    return WEEK_DAYS.map((label, i) => ({ label, value: m[i], pct: m[i] / max }))
  }, [txAll])

  // Annual data — inclui parcelas como gasto
  const annualData = useMemo(() => {
    const m: Record<number, { gastos: number; receitas: number }> = {}
    for (let i = 0; i < 12; i++) m[i] = { gastos: 0, receitas: 0 }
    txYear.forEach(t => {
      // Ignorar transações de crédito/parcela já pagas (cobertas pelo pagamento da fatura)
      if (paidTxIds.has(t.id)) return

      let mo = new Date(t.data + 'T12:00:00').getMonth()

      // Aplicar regra de fechamento do cartão de crédito
      if (t.tipo === 'gasto' && t.cartao_id) {
        const card = cartoes.find(c => c.id === t.cartao_id)
        if (card) {
          const buyDay = new Date(t.data + 'T12:00:00').getDate()
          if (buyDay >= card.dia_fechamento) {
            mo = mo === 11 ? 0 : mo + 1
          }
        }
      }

      if (t.tipo === 'gasto' || t.tipo === 'parcela') m[mo].gastos += t.valor
      else if (t.tipo === 'receita') m[mo].receitas += t.valor
    })
    return MONTHS_S.map((name, i) => ({ name, gastos: m[i].gastos, receitas: m[i].receitas, saldo: m[i].receitas - m[i].gastos }))
  }, [txYear, cartoes, paidTxIds])

  // Parcelas ativas — agora vem direto da tabela compras_parceladas
  const parcelasAtivas = useMemo(() => {
    return comprasParceladas.map(p => {
      const start = new Date(p.data_inicio + 'T12:00:00')
      const now = new Date()
      const elapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1
      const pagas = Math.min(Math.max(elapsed, 0), p.n_parcelas)
      return { ...p, pagas, restantes: p.n_parcelas - pagas, valorParcela: p.valor_parcela, total: p.n_parcelas }
    }).filter(p => p.restantes > 0)
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
              <MCard label="Total Gastos" value={fmt(totalG)} sub={`${gastosDebit.length + parcelasDebito.length} transações no débito/PIX`} icon={<ArrowDownCircle size={18} />} color="#ef4444" grad="rgba(239,68,68,0.1)" pct={pctG} pctInvert />
              <MCard label="Total Receitas" value={fmt(totalR)} sub={`${receitas.length} transações`} icon={<ArrowUpCircle size={18} />} color="#10b981" grad="rgba(16,185,129,0.1)" pct={pctR} />
              <MCard label="Saldo Real" value={fmt(saldoReal)} sub="Débito/PIX (crédito não incluído)" icon={saldoReal >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />} color={saldoReal >= 0 ? '#10b981' : '#ef4444'} grad={saldoReal >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'} highlight />
              <MCard label="Crédito a Pagar" value={fmt(totalCredit)} sub={(gastosCredit.length + parcelasCartao.length) > 0 ? `${gastosCredit.length + parcelasCartao.length} lançamento${(gastosCredit.length + parcelasCartao.length) > 1 ? 's' : ''} na fatura` : 'Nenhum lançamento na fatura'} icon={<CreditCard size={18} />} color="#f59e0b" grad="rgba(245,158,11,0.1)" />
            </div>

            {/* Detalhe Crédito a Pagar */}
            {totalCredit > 0 && (() => {
              const itens = [...gastosCredit, ...parcelasCartao]
              const porCartao = cartoes.reduce<Record<string, { id: string; nome: string; itens: Transacao[] }>>((acc, c) => {
                const ci = itens.filter(t => t.cartao_id === c.id)
                if (ci.length > 0) acc[c.id] = { id: c.id, nome: c.nome_cartao, itens: ci }
                return acc
              }, {})
              const grupos = Object.values(porCartao)
              if (grupos.length === 0) return null
              return (
                <div style={{ marginBottom: 16, padding: '14px 18px', borderRadius: 14, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Detalhes da Fatura</div>
                  {grupos.map((g, gi) => (
                    <div key={g.id} style={{ marginBottom: gi < grupos.length - 1 ? 16 : 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>💳 {g.nome}</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b' }}>{fmt(g.itens.reduce((a, t) => a + t.valor, 0))}</span>
                      </div>
                      {g.itens.map(t => (
                        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderRadius: 6, fontSize: '0.75rem', color: 'var(--text2)' }}>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.descricao}</span>
                          <span style={{ color: 'var(--text3)', margin: '0 10px', flexShrink: 0 }}>{t.data.split('-').reverse().join('/')}</span>
                          <span style={{ color: '#ef4444', fontWeight: 600, flexShrink: 0 }}>{fmt(t.valor)}</span>
                        </div>
                      ))}
                      <button
                        onClick={() => pagarFatura(g.id, g.itens)}
                        disabled={pagandoFatura === g.id}
                        style={{ marginTop: 10, width: '100%', padding: '8px 0', borderRadius: 8, border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.08)', color: '#10b981', fontSize: '0.75rem', fontWeight: 700, cursor: pagandoFatura === g.id ? 'not-allowed' : 'pointer', opacity: pagandoFatura === g.id ? 0.6 : 1, fontFamily: 'inherit' }}
                      >
                        {pagandoFatura === g.id ? 'Registrando...' : `✓ Paguei a fatura do ${g.nome}`}
                      </button>
                    </div>
                  ))}
                </div>
              )
            })()}

            {/* Insights row */}
            {txAll.length > 0 && (
              <div className="insight-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10, marginBottom: 20 }}>
                {isCurrentMonthYear && <ICard emoji="🔮" title="Previsão do mês" value={fmt(forecastTotal)} sub={`Ainda: ${fmt(forecastRemaining)}`} color="#f59e0b" />}
                <ICard emoji="📈" title="Média diária" value={fmt(avgDailySpend)} sub="de gastos por dia" color="#ef4444" />
                <ICard emoji="💰" title="Saldo comprometido" value={fmt(saldo)} sub={saldo >= 0 ? 'Incluindo crédito pendente' : 'Atenção ao crédito!'} color={saldo >= 0 ? '#10b981' : '#ef4444'} />
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
                        <div style={{ fontSize: '0.7rem', color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{isCurrentMonthYear ? 'Previsão de fechamento' : 'Total do mês'}</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f59e0b' }}>{fmt(forecastTotal)}</div>
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text2)', marginBottom: 6 }}>
                        <span>{isCurrentMonthYear ? `Gasto até hoje: ${fmt(totalG)}` : `Total gasto: ${fmt(totalG)}`}</span>
                        <span>{isCurrentMonthYear ? `Dia ${today}/${daysInMonth}` : 'Mês encerrado'}</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(today / daysInMonth * 100, 100)}%`, borderRadius: 4, background: 'linear-gradient(90deg,#6366f1,#f59e0b)' }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{isCurrentMonthYear ? 'Restante estimado' : 'Saldo do mês'}</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: isCurrentMonthYear ? '#ef4444' : saldo >= 0 ? '#10b981' : '#ef4444' }}>{fmt(isCurrentMonthYear ? forecastRemaining : saldo)}</div>
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
                        {(['all', 'gasto', 'receita', 'parcela'] as const).map(t => (
                          <button key={t} onClick={() => setFType(t)}
                            style={{
                              padding: '5px 10px', borderRadius: 8, border: '1px solid', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                              background: fType === t ? 'rgba(99,102,241,0.2)' : 'transparent',
                              borderColor: fType === t ? 'rgba(99,102,241,0.5)' : 'var(--border)',
                              color: fType === t ? '#a78bfa' : 'var(--text2)'
                            }}>
                            {t === 'all' ? 'Todos' : t === 'gasto' ? 'Gastos' : t === 'receita' ? 'Receitas' : 'Parcelas'}
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
                      {filteredTx.map((t, i) => <TRow key={t.id} t={t} i={i} cartoes={cartoes} onEdit={() => { setEditingTx(t); setEditingTxOriginalData(t.data) }} />)}
                    </div>
                    <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text2)' }}><strong style={{ color: 'var(--text)' }}>{filteredTx.length}</strong> transações</span>
                      <div style={{ display: 'flex', gap: 16, fontSize: '0.78rem' }}>
                        <span style={{ color: '#ef4444' }}>Gastos: <strong>{fmt(filteredTx.filter(t => t.tipo === 'gasto' || t.tipo === 'parcela').reduce((a, t) => a + t.valor, 0))}</strong></span>
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

      {/* Edit Modal */}
      {editingTx && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div className="glass" style={{ width: '100%', maxWidth: 400, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Editar Transação</h3>
              <button onClick={() => setEditingTx(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={saveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {editingTx.tipo === 'parcela' && (
                <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', fontSize: '0.75rem', color: '#a78bfa' }}>
                  ⚠️ Você está editando uma parcela. A fatura correspondente será atualizada automaticamente.
                </div>
              )}
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 6 }}>DESCRIÇÃO</label>
                <input className="input-field" type="text" value={editingTx.descricao || ''} onChange={e => setEditingTx({ ...editingTx, descricao: e.target.value })} required style={{ width: '100%' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 6 }}>VALOR (R$)</label>
                  <input className="input-field" type="number" step="0.01" value={editingTx.valor} onChange={e => setEditingTx({ ...editingTx, valor: parseFloat(e.target.value) || 0 })} required style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 6 }}>DATA</label>
                  <input className="input-field" type="date" value={editingTx.data} onChange={e => setEditingTx({ ...editingTx, data: e.target.value })} required style={{ width: '100%' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 6 }}>CATEGORIA</label>
                <select className="input-field" value={editingTx.categoria} onChange={e => setEditingTx({ ...editingTx, categoria: e.target.value })} style={{ width: '100%' }}>
                  {cats.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setEditingTx(null)} className="btn-ghost" style={{ flex: 1, padding: 12, justifyContent: 'center' }}>Cancelar</button>
                <button type="submit" disabled={savingTx} className="btn-primary" style={{ flex: 1, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {savingTx ? <RefreshCw size={16} className="animate-spin" /> : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────
export default function Page() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)', flexDirection: 'column', gap: 14 }}><div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Wallet size={20} color="white" /></div><p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Carregando...</p></div>}>
      <Dashboard />
    </Suspense>
  )
}
