import React from 'react'
import { fmt } from '@/lib/utils'

export function ChartTooltip({ active, payload, label }: any) {
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
