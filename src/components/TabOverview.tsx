import React from 'react'
import { Zap } from 'lucide-react'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, PieChart, Pie, Legend, LineChart, Line
} from 'recharts'
import { Transacao } from '@/lib/supabase'
import { cc, fmt } from '@/lib/utils'
import { Empty } from './Empty'
import { ChartTooltip } from './ChartTooltip'

type AreaPoint = { dia: string; gastos: number; receitas: number; acumulado: number }
type PiePoint = { name: string; value: number }
type DowPoint = { label: string; value: number; pct: number }

type Props = {
    txAll: Transacao[]
    areaData: AreaPoint[]
    pieData: PiePoint[]
    dowData: DowPoint[]
    totalG: number
    saldo: number
    isCurrentMonthYear: boolean
    forecastTotal: number
    forecastRemaining: number
    today: number
    daysInMonth: number
}

export function TabOverview({ txAll, areaData, pieData, dowData, totalG, saldo, isCurrentMonthYear, forecastTotal, forecastRemaining, today, daysInMonth }: Props) {
    if (txAll.length === 0) return <Empty />

    return (
        <div>
            {/* Area + Pie */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 14, marginBottom: 14 }}>
                <div className="glass" style={{ padding: 24 }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>ðŸ“ˆ EvoluÃ§Ã£o DiÃ¡ria</h3>
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={areaData}>
                            <defs>
                                <linearGradient id="gG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
                                <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.25} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="dia" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} />
                            <Tooltip content={<ChartTooltip />} />
                            <Legend formatter={v => <span style={{ color: '#94a3b8', fontSize: '0.76rem' }}>{v}</span>} />
                            <Area type="monotone" dataKey="gastos" stroke="#ef4444" strokeWidth={2} fill="url(#gG)" name="Gastos" dot={false} />
                            <Area type="monotone" dataKey="receitas" stroke="#10b981" strokeWidth={2} fill="url(#gR)" name="Receitas" dot={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className="glass" style={{ padding: 24 }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 18 }}>ðŸ’¸ Gastos por Categoria</h3>
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
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 18 }}>ðŸ’° Saldo Acumulado</h3>
                    <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={areaData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="dia" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} />
                            <Tooltip content={<ChartTooltip />} />
                            <Line type="monotone" dataKey="acumulado" stroke="#00bfa5" strokeWidth={2.5} dot={false} name="Saldo" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="glass" style={{ padding: 24 }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 18 }}>ðŸ—“ï¸ Gastos por Dia da Semana</h3>
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
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 18 }}>ðŸ… Ranking por Categoria</h3>
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
                        <div style={{ fontSize: '0.7rem', color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{isCurrentMonthYear ? 'PrevisÃ£o de fechamento' : 'Total do mÃªs'}</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f59e0b' }}>{fmt(forecastTotal)}</div>
                    </div>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text2)', marginBottom: 6 }}>
                        <span>{isCurrentMonthYear ? `Gasto atÃ© hoje: ${fmt(totalG)}` : `Total gasto: ${fmt(totalG)}`}</span>
                        <span>{isCurrentMonthYear ? `Dia ${today}/${daysInMonth}` : 'MÃªs encerrado'}</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(today / daysInMonth * 100, 100)}%`, borderRadius: 4, background: 'linear-gradient(90deg,#00bfa5,#f59e0b)' }} />
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text3)' }}>{isCurrentMonthYear ? 'Restante estimado' : 'Saldo do mÃªs'}</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: isCurrentMonthYear ? '#ef4444' : saldo >= 0 ? '#10b981' : '#ef4444' }}>
                        {fmt(isCurrentMonthYear ? forecastRemaining : saldo)}
                    </div>
                </div>
            </div>
        </div>
    )
}
