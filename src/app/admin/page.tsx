'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import {
    Users, TrendingUp, UserX, RefreshCw, CheckCircle, XCircle, Copy, ExternalLink,
    Search, Shield, DollarSign
} from 'lucide-react'

type Usuario = {
    id: string
    phone: string
    nome: string | null
    email: string | null
    status: string
    data_expiracao: string | null
    criado_em: string | null
    ultimo_acesso: string | null
    cakto_subscription_id: string | null
    token: string | null
}

const STATUS_COLOR: Record<string, { bg: string; color: string; label: string }> = {
    ativo: { bg: 'rgba(16,185,129,0.15)', color: '#10b981', label: '�S Ativo' },
    trial: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', label: '⏱ Trial' },
    inativo: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', label: '�S Inativo' },
}

function fmtDate(d: string | null) {
    if (!d) return '�'
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtPhone(p: string) {
    const c = p.replace(/\D/g, '')
    if (c.length === 13) return `+${c.slice(0, 2)} (${c.slice(2, 4)}) ${c.slice(4, 9)}-${c.slice(9)}`
    return p
}

function AdminPanel() {
    const sp = useSearchParams()
    const adminKey = sp.get('key') || ''
    const [usuarios, setUsuarios] = useState<Usuario[]>([])
    const [loading, setLoading] = useState(true)
    const [authError, setAuthError] = useState(false)
    const [search, setSearch] = useState('')
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [togglingId, setTogglingId] = useState<string | null>(null)
    const [copied, setCopied] = useState<string | null>(null)

    const fetchUsuarios = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/usuarios', { headers: { 'x-admin-key': adminKey } })
            if (res.status === 401) { setAuthError(true); setLoading(false); return }
            const json = await res.json()
            setUsuarios(json.usuarios || [])
        } catch { setAuthError(true) }
        setLoading(false)
    }, [adminKey])

    useEffect(() => {
        if (adminKey) { fetchUsuarios() } else { setAuthError(true) }
    }, [fetchUsuarios, adminKey])

    const toggleStatus = async (u: Usuario) => {
        const newStatus = u.status === 'ativo' ? 'inativo' : 'ativo'
        if (!confirm(`${newStatus === 'ativo' ? 'Ativar' : 'Desativar'} o usuário ${u.nome || u.phone}?`)) return
        setTogglingId(u.id)
        await fetch('/api/admin/usuarios', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
            body: JSON.stringify({ id: u.id, status: newStatus }),
        })
        setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, status: newStatus } : x))
        setTogglingId(null)
    }

    const copyLink = (token: string | null) => {
        if (!token) return
        const url = `${window.location.origin}?token=${token}`
        navigator.clipboard.writeText(url)
        setCopied(token)
        setTimeout(() => setCopied(null), 2000)
    }

    // ������ Computed metrics ������������������������������������������������������������������������������������������������������������
    const ativos = usuarios.filter(u => u.status === 'ativo').length
    const trial = usuarios.filter(u => u.status === 'trial').length
    const inativos = usuarios.filter(u => u.status === 'inativo').length
    const mrr = ativos * 29.9

    const filtered = usuarios.filter(u => {
        const matchSearch = !search || [u.nome, u.email, u.phone].some(f => f?.toLowerCase().includes(search.toLowerCase()))
        const matchStatus = filterStatus === 'all' || u.status === filterStatus
        return matchSearch && matchStatus
    })

    // ������ Expiração próxima ����������������������������������������������������������������������������������������������������������
    const expirando = usuarios.filter(u => {
        if (u.status !== 'ativo' || !u.data_expiracao) return false
        const days = (new Date(u.data_expiracao).getTime() - Date.now()) / 86400000
        return days <= 5
    }).length

    if (authError) return (
        <div style={{ minHeight: '100vh', background: '#080c14', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
            <Shield size={48} color="#ef4444" />
            <h1 style={{ color: '#f1f5f9', fontSize: '1.5rem', fontWeight: 700 }}>Acesso Restrito</h1>
            <p style={{ color: '#94a3b8' }}>Acesse via <code style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: 6 }}>/admin?key=SUA_CHAVE</code></p>
        </div>
    )

    return (
        <div style={{ minHeight: '100vh', background: '#080c14', color: '#f1f5f9', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {/* Background */}
            <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
                <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: '50%', height: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.07) 0%,transparent 70%)', borderRadius: '50%' }} />
            </div>

            <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#00bfa5,#00e676)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,191,165,0.4)' }}>
                            <Shield size={20} color="white" />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '1.3rem', fontWeight: 800, background: 'linear-gradient(135deg,#f1f5f9,#69f0ae)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Admin � GestorZap</h1>
                            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>{usuarios.length} usuários no total</p>
                        </div>
                    </div>
                    <button onClick={fetchUsuarios} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'inherit' }}>
                        <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Atualizar
                    </button>
                </div>

                {/* Metric cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 28 }}>
                    {[
                        { label: 'Assinantes Ativos', value: ativos, icon: <Users size={18} />, color: '#10b981', grad: 'rgba(16,185,129,0.1)' },
                        { label: 'MRR Estimado', value: `R$ ${mrr.toFixed(2).replace('.', ',')}`, icon: <DollarSign size={18} />, color: '#00bfa5', grad: 'rgba(0,191,165,0.1)' },
                        { label: 'Em Trial', value: trial, icon: <TrendingUp size={18} />, color: '#f59e0b', grad: 'rgba(245,158,11,0.1)' },
                        { label: 'Inativos', value: inativos, icon: <UserX size={18} />, color: '#ef4444', grad: 'rgba(239,68,68,0.1)' },
                    ].map((m, i) => (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '20px', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, background: m.grad, borderRadius: '50%', transform: 'translate(40%,-40%)', filter: 'blur(12px)' }} />
                            <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{m.label}</div>
                            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: m.color }}>{m.value}</div>
                            <div style={{ position: 'absolute', bottom: 16, right: 16, color: m.color, opacity: 0.7 }}>{m.icon}</div>
                        </div>
                    ))}
                </div>

                {/* Expiring soon alert */}
                {expirando > 0 && (
                    <div style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 12, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.82rem', color: '#f59e0b' }}>
                        �a�️ <strong>{expirando} assinante{expirando > 1 ? 's' : ''}</strong> com expiração nos próximos 5 dias
                    </div>
                )}

                {/* Filters */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', flex: 1, minWidth: 200 }}>
                        <Search size={14} color="#64748b" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, email ou telefone..." style={{ background: 'none', border: 'none', outline: 'none', color: '#f1f5f9', fontSize: '0.82rem', fontFamily: 'inherit', width: '100%' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                        {(['all', 'ativo', 'trial', 'inativo'] as const).map(s => (
                            <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', background: filterStatus === s ? 'rgba(99,102,241,0.2)' : 'transparent', borderColor: filterStatus === s ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)', color: filterStatus === s ? '#69f0ae' : '#64748b' }}>
                                {s === 'all' ? 'Todos' : s === 'ativo' ? 'Ativos' : s === 'trial' ? 'Trial' : 'Inativos'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Table */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
                                    {['Usuário', 'Telefone', 'Status', 'Expira em', 'Criado em', '�altimo acesso', 'Ações'].map(h => (
                                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#475569' }}>Carregando...</td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#475569' }}>Nenhum usuário encontrado</td></tr>
                                ) : filtered.map(u => {
                                    const st = STATUS_COLOR[u.status] || STATUS_COLOR.inativo
                                    const expirado = u.data_expiracao && new Date(u.data_expiracao) < new Date()
                                    const expiraBreve = u.data_expiracao && !expirado && (new Date(u.data_expiracao).getTime() - Date.now()) / 86400000 <= 5
                                    return (
                                        <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }} onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)')} onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}>
                                            <td style={{ padding: '14px 16px' }}>
                                                <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{u.nome || '(sem nome)'}</div>
                                                <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: 2 }}>{u.email || '�'}</div>
                                            </td>
                                            <td style={{ padding: '14px 16px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{fmtPhone(u.phone)}</td>
                                            <td style={{ padding: '14px 16px' }}>
                                                <span style={{ padding: '3px 10px', borderRadius: 20, background: st.bg, color: st.color, fontWeight: 700, fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{st.label}</span>
                                            </td>
                                            <td style={{ padding: '14px 16px', color: expirado ? '#ef4444' : expiraBreve ? '#f59e0b' : '#64748b', whiteSpace: 'nowrap', fontWeight: (expirado || expiraBreve) ? 600 : 400 }}>
                                                {fmtDate(u.data_expiracao)}{expirado ? ' �a�️' : expiraBreve ? ' ⏳' : ''}
                                            </td>
                                            <td style={{ padding: '14px 16px', color: '#475569', whiteSpace: 'nowrap' }}>{fmtDate(u.criado_em)}</td>
                                            <td style={{ padding: '14px 16px', color: '#475569', whiteSpace: 'nowrap' }}>{fmtDate(u.ultimo_acesso)}</td>
                                            <td style={{ padding: '14px 16px' }}>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button onClick={() => toggleStatus(u)} disabled={togglingId === u.id} title={u.status === 'ativo' ? 'Desativar' : 'Ativar'} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 600, background: u.status === 'ativo' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', borderColor: u.status === 'ativo' ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)', color: u.status === 'ativo' ? '#ef4444' : '#10b981', opacity: togglingId === u.id ? 0.5 : 1 }}>
                                                        {u.status === 'ativo' ? <XCircle size={13} /> : <CheckCircle size={13} />}
                                                    </button>
                                                    <button onClick={() => copyLink(u.token)} title="Copiar link do dashboard" style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', background: copied === u.token ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)', color: copied === u.token ? '#69f0ae' : '#64748b', fontFamily: 'inherit' }}>
                                                        <Copy size={13} />
                                                    </button>
                                                    <a href={`https://wa.me/${u.phone}`} target="_blank" rel="noreferrer" title="Abrir WhatsApp" style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#64748b', display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
                                                        <ExternalLink size={13} />
                                                    </a>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                    {filtered.length > 0 && (
                        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#475569' }}>
                            <span><strong style={{ color: '#94a3b8' }}>{filtered.length}</strong> de {usuarios.length} usuários</span>
                            <span>MRR filtrado: <strong style={{ color: '#00bfa5' }}>R$ {(filtered.filter(u => u.status === 'ativo').length * 29.9).toFixed(2).replace('.', ',')}</strong></span>
                        </div>
                    )}
                </div>
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } } * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>
        </div>
    )
}

export default function AdminPage() {
    return (
        <Suspense fallback={
            <div style={{ minHeight: '100vh', background: '#080c14', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontFamily: 'Inter, system-ui, sans-serif' }}>
                Carregando...
            </div>
        }>
            <AdminPanel />
        </Suspense>
    )
}
