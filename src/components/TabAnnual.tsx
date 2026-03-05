import React from 'react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { MONTHS_PT } from '@/lib/utils'
import { fmt } from '@/lib/utils'
import { ChartTooltip } from './ChartTooltip'

type AnnualRow = { name: string; gastos: number; receitas: number; saldo: number }

type Props = {
    annualData: AnnualRow[]
    year: number
    month: number
}

export function TabAnnual({ annualData, year, month }: Props) {
    return (
        <div>
            <div className="glass" style={{ padding: 24, marginBottom: 14 }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 18 }}>Visão Anual  {year}</h3>
                <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={annualData} margin={{ bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend formatter={v => <span style={{ color: '#94a3b8', fontSize: '0.76rem' }}>{v}</span>} />
                        <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="receitas" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="glass" style={{ padding: 24 }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 14 }}>= Tabela Mensal</h3>
                <div className="table-wrap" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                {['Ms', 'Gastos', 'Receitas', 'Saldo'].map(h => (
                                    <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Ms' ? 'left' : 'right', color: 'var(--text3)', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
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
    )
}
