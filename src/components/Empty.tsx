import React from 'react'

export function Empty({ msg = 'Nenhuma transação neste período' }: { msg?: string }) {
    return (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '2rem', marginBottom: 10 }}>📭</div>
            <p style={{ color: 'var(--text2)', fontSize: '0.88rem' }}>{msg}</p>
        </div>
    )
}
