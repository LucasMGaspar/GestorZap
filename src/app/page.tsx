'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSupabase, Transacao, Cartao, CompraParcelada } from '@/lib/supabase'
import {
  Wallet, RefreshCw, TrendingDown, TrendingUp, ArrowDownCircle, ArrowUpCircle,
  Calendar, CreditCard, X, Edit3, AlertTriangle
} from 'lucide-react'

import { Empty } from '@/components/Empty'
import { ICard } from '@/components/ICard'
import { MCard } from '@/components/MCard'
import { TabOverview } from '@/components/TabOverview'
import { TabTransactions } from '@/components/TabTransactions'
import { TabAnnual } from '@/components/TabAnnual'
import { TabBudget } from '@/components/TabBudget'
import { TabCards } from '@/components/TabCards'
import { MONTHS_PT, MONTHS_S, WEEK_DAYS, CAT, cc, fmt, h2r } from '@/lib/utils'

// ������ Main ����������������������������������������������������������������������������������������������������������������������������������������
function Dashboard() {
  const sp = useSearchParams()
  const [token] = useState(sp.get('token') || '')
  const [authError, setAuthError] = useState<string | null>(null)
  const [phone, setPhone] = useState('')

  // Data
  const [txAll, setTxAll] = useState<Transacao[]>([])
  const [txPrev, setTxPrev] = useState<Transacao[]>([])
  const [txYear, setTxYear] = useState<Transacao[]>([])
  const [comprasParceladas, setComprasParceladas] = useState<CompraParcelada[]>([])
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [loading, setLoading] = useState(false)
  const [pagandoFatura, setPagandoFatura] = useState<string | null>(null)

  // Navigation
  const [month, setMonth] = useState(new Date().getMonth())
  const [year, setYear] = useState(new Date().getFullYear())
  const [tab, setTab] = useState<'transactions' | 'cards' | 'budget' | 'annual' | 'overview'>('transactions')

  // Transaction filters
  const [fType, setFType] = useState<'all' | 'gasto' | 'receita' | 'parcela'>('all')
  const [fCat, setFCat] = useState('all')
  const [fMin, setFMin] = useState('')
  const [fMax, setFMax] = useState('')
  const [fStart, setFStart] = useState('')
  const [fEnd, setFEnd] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [search, setSearch] = useState('')

  // Budgets
  const [budgets, setBudgets] = useState<Record<string, number>>({})
  const [editBudget, setEditBudget] = useState<Record<string, string>>({})

  // Cards form
  const [newCard, setNewCard] = useState({ nome_cartao: '', dia_fechamento: 1, dia_vencimento: 10 })
  const [savingCard, setSavingCard] = useState(false)

  // Edit transaction modal
  const [editingTx, setEditingTx] = useState<Transacao | null>(null)
  const [editingTxOriginalData, setEditingTxOriginalData] = useState<string>('')
  const [savingTx, setSavingTx] = useState(false)

  // Subscription status
  const [userStatus, setUserStatus] = useState<string>('ativo')
  const [userExpiracao, setUserExpiracao] = useState<string | null>(null)

  // Load budgets from localStorage on startup
  useEffect(() => {
    try { const b = localStorage.getItem('fin_budgets'); if (b) setBudgets(JSON.parse(b)) } catch { }
  }, [])

  // ������ Save budget (localStorage + Supabase) ����������������������������������������������������������������
  const saveBudget = useCallback(async (cat: string, val: string) => {
    const n = parseFloat(val); if (isNaN(n) || n <= 0) return
    const next = { ...budgets, [cat]: n }
    setBudgets(next)
    localStorage.setItem('fin_budgets', JSON.stringify(next))
    if (phone) {
      try {
        const client = getSupabase()
        if (client) await client.from('budgets').upsert({ phone, categoria: cat, valor: n }, { onConflict: 'phone,categoria' })
      } catch { /* fallback localStorage já salvo */ }
    }
  }, [budgets, phone])

  // ������ Fetch data ����������������������������������������������������������������������������������������������������������������������
  const fetchData = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setAuthError(null)
    try {
      const client = getSupabase()
      if (!client) { setLoading(false); return }

      // Step 1: validate token
      const { data: userData, error: userErr } = await client
        .from('usuarios').select('phone, status, data_expiracao').eq('token', token).single()
      if (userErr || !userData) { setAuthError('token_invalido'); setLoading(false); return }

      const resolvedPhone = userData.phone
      setPhone(resolvedPhone)
      if (userData.status) setUserStatus(userData.status)
      if (userData.data_expiracao) setUserExpiracao(userData.data_expiracao)

      // Step 2: date ranges
      const pmMonth = month === 0 ? 11 : month - 1
      const pmYear = month === 0 ? year - 1 : year
      const prevPmMonth = pmMonth === 0 ? 11 : pmMonth - 1
      const prevPmYear = pmMonth === 0 ? pmYear - 1 : pmYear
      const [pm, py] = [pmMonth, pmYear]

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
        client.from('cartoes').select('*').eq('phone', resolvedPhone).order('nome_cartao', { ascending: true }),
      ])

      const fetchedCards = r5.data ?? []

      // Credit card cycle logic: determine which month a transaction truly belongs to
      const getRealMonthYear = (t: Transacao, cards: Cartao[]) => {
        const txDate = new Date(t.data + 'T12:00:00')
        const txMo = txDate.getMonth()
        const txYr = txDate.getFullYear()
        if (t.tipo !== 'gasto' || !t.cartao_id) return { m: txMo, y: txYr }
        const card = cards.find(c => c.id === t.cartao_id)
        if (!card) return { m: txMo, y: txYr }
        const buyDay = txDate.getDate()
        let targetMo = txMo, targetYr = txYr
        if (buyDay >= card.dia_fechamento) {
          targetMo += 1
          if (targetMo > 11) { targetMo = 0; targetYr += 1 }
        }
        return { m: targetMo, y: targetYr }
      }

      const processTxByCycle = (txs: Transacao[]) =>
        txs.filter(t => { const tgt = getRealMonthYear(t, fetchedCards); return tgt.m === month && tgt.y === year })
      const processPrevTx = (txs: Transacao[]) =>
        txs.filter(t => { const tgt = getRealMonthYear(t, fetchedCards); return tgt.m === pm && tgt.y === py })

      if (r1.data) setTxAll(processTxByCycle(r1.data))
      if (r2.data) setTxPrev(processPrevTx(r2.data))
      if (r3.data) setTxYear(r3.data)
      setComprasParceladas(r4.data ?? [])
      setCartoes(fetchedCards)

      // Step 3: sync budgets from Supabase (override localStorage if data found)
      try {
        const { data: bdData } = await client.from('budgets').select('categoria,valor').eq('phone', resolvedPhone)
        if (bdData && bdData.length > 0) {
          const sbBudgets: Record<string, number> = {}
          bdData.forEach((b: any) => { sbBudgets[b.categoria] = b.valor })
          setBudgets(sbBudgets)
          localStorage.setItem('fin_budgets', JSON.stringify(sbBudgets))
        }
      } catch { /* tabela budgets pode não existir, usar localStorage */ }

    } catch { setAuthError('erro_rede') }
    setLoading(false)
  }, [token, month, year])

  useEffect(() => { fetchData() }, [fetchData])

  // ������ Card CRUD ������������������������������������������������������������������������������������������������������������������������
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
      if (error) { alert('Não foi possível excluir. Este cartão possui transações vinculadas.'); return }
      setCartoes(prev => prev.filter(c => c.id !== id))
    }
  }

  // ������ Edit transaction ����������������������������������������������������������������������������������������������������������
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
        alert('Erro ao salvar a edição. Tente novamente.')
      }
    }
    setSavingTx(false)
  }

  // ������ Pay bill ��������������������������������������������������������������������������������������������������������������������������
  const pagarFatura = async (cartaoId: string, itens: Transacao[]) => {
    const cartao = cartoes.find(c => c.id === cartaoId)
    const total = itens.reduce((a, t) => a + t.valor, 0)
    if (!confirm(`Confirmar pagamento da fatura ${cartao?.nome_cartao} de ${fmt(total)}?\n\nUma transação PIX/débito será criada no valor total.`)) return
    setPagandoFatura(cartaoId)
    const client = getSupabase()
    if (client) {
      const diaVenc = cartao?.dia_vencimento || 1
      const hoje = `${year}-${String(month + 1).padStart(2, '0')}-${String(diaVenc).padStart(2, '0')}`
      await client.from('transacoes').insert({ phone, tipo: 'gasto', valor: total, categoria: 'Transferência', descricao: `Pagamento fatura ${cartao?.nome_cartao}`, data: hoje, cartao_id: null, criado_em: new Date().toISOString() })
      const parcelas = itens.filter(t => t.tipo === 'parcela' && t.compra_parcelada_id)
      for (const p of parcelas) {
        await client.from('faturas').update({ status: 'pago' }).eq('compra_parcelada_id', p.compra_parcelada_id!).eq('vencimento', p.data)
      }
      await fetchData()
    }
    setPagandoFatura(null)
  }

  // ������ CSV Export ����������������������������������������������������������������������������������������������������������������������
  const exportCSV = () => {
    const rows = [['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor'], ...filteredTx.map(t => [t.data, t.tipo, t.categoria, t.descricao, t.valor.toFixed(2).replace('.', ',')])]
    const csv = rows.map(r => r.map(c => `"${c}"`).join(';')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `transacoes-${MONTHS_PT[month]}-${year}.csv`; a.click()
  }

  // ������ Derived data ������������������������������������������������������������������������������������������������������������������
  const paidCartaoIds = new Set<string>()
  txAll.forEach(t => {
    if (t.tipo === 'gasto' && !t.cartao_id && t.categoria === 'Transferência' && t.descricao?.startsWith('Pagamento fatura ')) {
      const nome = t.descricao.replace('Pagamento fatura ', '')
      const cartao = cartoes.find(c => c.nome_cartao === nome)
      if (cartao) paidCartaoIds.add(cartao.id)
    }
  })

  const gastosDebit = txAll.filter(t => t.tipo === 'gasto' && !t.cartao_id)
  const gastosCredit = txAll.filter(t => t.tipo === 'gasto' && !!t.cartao_id && !paidCartaoIds.has(t.cartao_id!))
  const parcelasCartao = txAll.filter(t => t.tipo === 'parcela' && !!t.cartao_id && !paidCartaoIds.has(t.cartao_id!))
  const parcelasDebito = txAll.filter(t => t.tipo === 'parcela' && !t.cartao_id)
  const receitas = txAll.filter(t => t.tipo === 'receita')

  const totalDebit = gastosDebit.reduce((a, t) => a + t.valor, 0)
  const totalParcDebito = parcelasDebito.reduce((a, t) => a + t.valor, 0)
  const totalG = totalDebit + totalParcDebito
  const totalR = receitas.reduce((a, t) => a + t.valor, 0)
  const totalCredit = gastosCredit.reduce((a, t) => a + t.valor, 0) + parcelasCartao.reduce((a, t) => a + t.valor, 0)
  const saldoReal = totalR - totalDebit - totalParcDebito
  const saldo = totalR - totalG - totalCredit

  const pGastos = txPrev.filter(t => (t.tipo === 'gasto' && !t.cartao_id) || (t.tipo === 'parcela' && !t.cartao_id)).reduce((a, t) => a + t.valor, 0)
  const pReceitas = txPrev.filter(t => t.tipo === 'receita').reduce((a, t) => a + t.valor, 0)
  const pct = (now: number, prev: number) => prev === 0 ? null : Math.round((now - prev) / prev * 100)
  const pctG = pct(totalG, pGastos), pctR = pct(totalR, pReceitas)

  const catMap = useMemo(() => {
    const m: Record<string, number> = {}
    txAll.filter(t => t.tipo === 'gasto' || t.tipo === 'parcela').forEach(t => { m[t.categoria] = (m[t.categoria] || 0) + t.valor })
    return m
  }, [txAll])

  const pieData = Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))

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

  const _today = new Date()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const isCurrentMonthYear = month === _today.getMonth() && year === _today.getFullYear()
  const today = isCurrentMonthYear ? _today.getDate() : daysInMonth
  const avgDailySpend = today > 0 ? totalG / today : 0
  const forecastTotal = isCurrentMonthYear ? avgDailySpend * daysInMonth : totalG
  const forecastRemaining = forecastTotal - totalG

  const dowData = useMemo(() => {
    const m = Array(7).fill(0)
    txAll.filter(t => t.tipo === 'gasto' || t.tipo === 'parcela').forEach(t => { const d = new Date(t.data + 'T12:00:00'); m[d.getDay()] += t.valor })
    const max = Math.max(...m, 1)
    return WEEK_DAYS.map((label, i) => ({ label, value: m[i], pct: m[i] / max }))
  }, [txAll])

  const annualData = useMemo(() => {
    const paidAnnualBills = new Set<string>()
    txYear.forEach(t => {
      if (t.tipo === 'gasto' && !t.cartao_id && t.categoria === 'Transferência' && t.descricao?.startsWith('Pagamento fatura ')) {
        const nome = t.descricao.replace('Pagamento fatura ', '')
        const cartao = cartoes.find(c => c.nome_cartao === nome)
        if (cartao) { const mo = new Date(t.data + 'T12:00:00').getMonth(); paidAnnualBills.add(`${cartao.id}-${mo}`) }
      }
    })
    const m: Record<number, { gastos: number; receitas: number }> = {}
    for (let i = 0; i < 12; i++) m[i] = { gastos: 0, receitas: 0 }
    txYear.forEach(t => {
      let mo = new Date(t.data + 'T12:00:00').getMonth()
      if (t.tipo === 'gasto' && t.cartao_id) {
        const card = cartoes.find(c => c.id === t.cartao_id)
        if (card) { const buyDay = new Date(t.data + 'T12:00:00').getDate(); if (buyDay >= card.dia_fechamento) mo = mo === 11 ? 0 : mo + 1 }
        if (paidAnnualBills.has(`${t.cartao_id}-${mo}`)) return
      }
      if (t.tipo === 'parcela' && t.cartao_id && paidAnnualBills.has(`${t.cartao_id}-${mo}`)) return
      if (t.tipo === 'gasto' || t.tipo === 'parcela') m[mo].gastos += t.valor
      else if (t.tipo === 'receita') m[mo].receitas += t.valor
    })
    return MONTHS_S.map((name, i) => ({ name, gastos: m[i].gastos, receitas: m[i].receitas, saldo: m[i].receitas - m[i].gastos }))
  }, [txYear, cartoes])

  const parcelasAtivas = useMemo(() => {
    return comprasParceladas.map(p => {
      const start = new Date(p.data_inicio + 'T12:00:00')
      const now = new Date()
      const elapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()) + 1
      const pagas = Math.min(Math.max(elapsed, 0), p.n_parcelas)
      return { ...p, pagas, restantes: p.n_parcelas - pagas, valorParcela: p.valor_parcela, total: p.n_parcelas }
    }).filter(p => p.restantes > 0)
  }, [comprasParceladas])

  const filteredTx = useMemo(() => {
    let tx = txAll.filter(t => !t.cartao_id)
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
  const cats = Object.keys(CAT)
  const years = [year - 1, year, year + 1]

  // ������ Render ������������������������������������������������������������������������������������������������������������������������������
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 0 }}>
      {/* Background blobs */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '60%', height: '60%', background: 'radial-gradient(circle,rgba(0,191,165,0.06) 0%,transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '60%', height: '60%', background: 'radial-gradient(circle,rgba(0,230,118,0.05) 0%,transparent 70%)', borderRadius: '50%' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1280, margin: '0 auto', padding: '28px 24px' }} className="mobile-pad">
        {/* Header */}
        <header className="dash-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, overflow: 'hidden', boxShadow: '0 8px 24px rgba(16,185,129,0.35)' }}>
              <img src="/logo.png" alt="GestorZap" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 800, background: 'linear-gradient(135deg,#f1f5f9,#69f0ae)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Gestor Financeiro</h1>
              <p style={{ fontSize: '0.76rem', color: 'var(--text2)', marginTop: 1 }}>Dashboard pessoal via WhatsApp</p>
            </div>
          </div>
          <div className="dash-header-controls" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {phone && <span style={{ fontSize: '0.75rem', color: 'var(--text2)', padding: '7px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>�x� +{phone}</span>}
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
        {/* Subscription warning banner */}
        {phone && (() => {
          const now = Date.now()
          const expMs = userExpiracao ? new Date(userExpiracao).getTime() : null
          const daysLeft = expMs ? Math.floor((expMs - now) / 86400000) : null
          const isExpired = userStatus === 'inativo' || (expMs !== null && expMs < now)
          const isExpiringSoon = !isExpired && daysLeft !== null && daysLeft <= 5
          const salesUrl = process.env.NEXT_PUBLIC_SALES_PAGE_URL || '#'
          if (!isExpired && !isExpiringSoon) return null
          return (
            <div style={{ marginBottom: 20, padding: '12px 18px', borderRadius: 12, background: isExpired ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${isExpired ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={16} color={isExpired ? '#ef4444' : '#f59e0b'} />
                <span style={{ fontSize: '0.82rem', color: isExpired ? '#f87171' : '#fbbf24', fontWeight: 600 }}>
                  {isExpired ? '�a�️ Sua assinatura está inativa. Renove para continuar usando o GestorZap.' : `⏳ Sua assinatura expira em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}. Renove para não perder o acesso.`}
                </span>
              </div>
              <a href={salesUrl} target="_blank" rel="noreferrer" style={{ padding: '7px 16px', borderRadius: 8, background: isExpired ? '#ef4444' : '#f59e0b', color: 'white', fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                Renovar agora � R$29,90/mês
              </a>
            </div>
          )
        })()}

        {/* Auth states */}
        {authError === 'token_required' || (!token && !loading) ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><span style={{ fontSize: '2rem' }}>�x</span></div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 8 }}>Acesso Restrito</h2>
            <p style={{ color: 'var(--text2)', fontSize: '0.9rem' }}>Este dashboard só pode ser acessado pelo link enviado no seu WhatsApp.</p>
          </div>
        ) : authError === 'token_invalido' ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><span style={{ fontSize: '2rem' }}>�R</span></div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 8 }}>Token Inválido</h2>
            <p style={{ color: 'var(--text2)', fontSize: '0.9rem' }}>O link de acesso não é válido ou expirou. Peça um novo link pelo WhatsApp.</p>
          </div>
        ) : loading && !phone ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text2)' }}>Carregando...</div>
        ) : (
          <div>
            {/* Month label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.15)' }}>
                <Calendar size={12} color="#69f0ae" />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#69f0ae' }}>{MONTHS_PT[month]} {year}</span>
              </div>
              <span style={{ color: 'var(--text3)', fontSize: '0.78rem' }}>{txAll.length} transações</span>
            </div>

            {/* Summary metric cards */}
            <div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 16 }}>
              <MCard label="Total Gastos" value={fmt(totalG)} sub={`${gastosDebit.length + parcelasDebito.length} transações no débito/PIX`} icon={<ArrowDownCircle size={18} />} color="#ef4444" grad="rgba(239,68,68,0.1)" pct={pctG} pctInvert />
              <MCard label="Total Receitas" value={fmt(totalR)} sub={`${receitas.length} transações`} icon={<ArrowUpCircle size={18} />} color="#10b981" grad="rgba(16,185,129,0.1)" pct={pctR} />
              <MCard label="Saldo Real" value={fmt(saldoReal)} sub="Débito/PIX (crédito não incluído)" icon={saldoReal >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />} color={saldoReal >= 0 ? '#10b981' : '#ef4444'} grad={saldoReal >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'} highlight />
              <MCard label="Crédito a Pagar" value={fmt(totalCredit)} sub={(gastosCredit.length + parcelasCartao.length) > 0 ? `${gastosCredit.length + parcelasCartao.length} lançamento${(gastosCredit.length + parcelasCartao.length) > 1 ? 's' : ''} na fatura` : 'Nenhum lançamento na fatura'} icon={<CreditCard size={18} />} color="#f59e0b" grad="rgba(245,158,11,0.1)" />
            </div>

            {/* Credit detail */}
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
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>�x� {g.nome}</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b' }}>{fmt(g.itens.reduce((a, t) => a + t.valor, 0))}</span>
                      </div>
                      {g.itens.map(t => (
                        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderRadius: 6, fontSize: '0.75rem', color: 'var(--text2)' }}>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.descricao}</span>
                          <span style={{ color: 'var(--text3)', margin: '0 10px', flexShrink: 0 }}>{t.data.split('-').reverse().join('/')}</span>
                          <span style={{ color: '#ef4444', fontWeight: 600, flexShrink: 0 }}>{fmt(t.valor)}</span>
                        </div>
                      ))}
                      <button onClick={() => pagarFatura(g.id, g.itens)} disabled={pagandoFatura === g.id} style={{ marginTop: 10, width: '100%', padding: '8px 0', borderRadius: 8, border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.08)', color: '#10b981', fontSize: '0.75rem', fontWeight: 700, cursor: pagandoFatura === g.id ? 'not-allowed' : 'pointer', opacity: pagandoFatura === g.id ? 0.6 : 1, fontFamily: 'inherit' }}>
                        {pagandoFatura === g.id ? 'Registrando...' : `�S Paguei a fatura do ${g.nome}`}
                      </button>
                    </div>
                  ))}
                </div>
              )
            })()}

            {/* Insights */}
            {txAll.length > 0 && (
              <div className="insight-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10, marginBottom: 20 }}>
                {isCurrentMonthYear && <ICard emoji="�x�" title="Previsão do mês" value={fmt(forecastTotal)} sub={`Ainda: ${fmt(forecastRemaining)}`} color="#f59e0b" />}
                <ICard emoji="�x�" title="Média diária" value={fmt(avgDailySpend)} sub="de gastos por dia" color="#ef4444" />
                <ICard emoji="�x�" title="Saldo comprometido" value={fmt(saldo)} sub={saldo >= 0 ? 'Incluindo crédito pendente' : 'Atenção ao crédito!'} color={saldo >= 0 ? '#10b981' : '#ef4444'} />
              </div>
            )}

            {/* Tab bar */}
            <div className="tab-bar" style={{ display: 'flex', gap: 4, marginBottom: 18, background: 'rgba(255,255,255,0.04)', padding: 4, borderRadius: 12, width: 'fit-content', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
              {(['transactions', 'cards', 'budget', 'annual', 'overview'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.2s', background: tab === t ? 'linear-gradient(135deg,#00bfa5,#00e676)' : 'transparent', color: tab === t ? 'white' : '#94a3b8' }}>
                  {t === 'transactions' ? '�x�� Transações' : t === 'cards' ? '�x� Cartões' : t === 'budget' ? '�x}� Orçamento' : t === 'annual' ? '�x& Anual' : '�x` Visão Geral'}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {tab === 'overview' && (
              <TabOverview txAll={txAll} areaData={areaData} pieData={pieData} dowData={dowData} totalG={totalG} saldo={saldo} isCurrentMonthYear={isCurrentMonthYear} forecastTotal={forecastTotal} forecastRemaining={forecastRemaining} today={today} daysInMonth={daysInMonth} />
            )}
            {tab === 'transactions' && (
              <TabTransactions filteredTx={filteredTx} cartoes={cartoes} month={month} cats={cats} fType={fType} fCat={fCat} fMin={fMin} fMax={fMax} fStart={fStart} fEnd={fEnd} showFilters={showFilters} search={search} activeFilters={activeFilters} setFType={setFType} setFCat={setFCat} setFMin={setFMin} setFMax={setFMax} setFStart={setFStart} setFEnd={setFEnd} setShowFilters={setShowFilters} setSearch={setSearch} exportCSV={exportCSV} onEdit={t => { setEditingTx(t); setEditingTxOriginalData(t.data) }} />
            )}
            {tab === 'annual' && (
              <TabAnnual annualData={annualData} year={year} month={month} />
            )}
            {tab === 'budget' && (
              <TabBudget catMap={catMap} totalG={totalG} parcelasAtivas={parcelasAtivas} cartoes={cartoes} budgets={budgets} editBudget={editBudget} setEditBudget={setEditBudget} saveBudget={saveBudget} year={year} />
            )}
            {tab === 'cards' && (
              <TabCards cartoes={cartoes} newCard={newCard} savingCard={savingCard} pagandoFatura={pagandoFatura} setNewCard={setNewCard} addCard={addCard} deleteCard={deleteCard} pagarFatura={pagarFatura} gastosCredit={gastosCredit} parcelasCartao={parcelasCartao} paidCartaoIds={paidCartaoIds} />
            )}
          </div>
        )}
      </div>

      {/* Edit Transaction Modal */}
      {editingTx && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
          <div className="glass" style={{ width: '100%', maxWidth: 400, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Editar Transação</h3>
              <button onClick={() => setEditingTx(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={saveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {editingTx.tipo === 'parcela' && (
                <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.15)', fontSize: '0.75rem', color: '#69f0ae' }}>
                  �a�️ Você está editando uma parcela. A fatura correspondente será atualizada automaticamente.
                </div>
              )}
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 6 }}>DESCRI�!ÒO</label>
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

// ������ Export ��������������������������������������������������������������������������������������������������������������������������������������
export default function Page() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)', flexDirection: 'column', gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#00bfa5,#00e676)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Wallet size={20} color="white" /></div>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Carregando...</p>
      </div>
    }>
      <Dashboard />
    </Suspense>
  )
}

