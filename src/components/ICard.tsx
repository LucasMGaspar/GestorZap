import React from 'react'

export function ICard({ emoji, title, value, sub, color }: { emoji: string; title: string; value: string; sub: string; color: string }) {
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
