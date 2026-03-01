import React from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

export function MCard({ label, value, sub, icon, color, grad, pct, pctInvert, highlight }: { label: string; value: string; sub: string; icon: React.ReactNode; color: string; grad: string; pct?: number | null; pctInvert?: boolean; highlight?: boolean }) {
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
