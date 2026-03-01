import React from 'react'
import { ShoppingCart, Car, Heart, BookOpen, Gamepad2, Home, Shirt, CreditCard, ArrowLeftRight, MoreHorizontal } from 'lucide-react'

export const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
export const MONTHS_S = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
export const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export const CAT: Record<string, { color: string; icon: React.ReactNode }> = {
    'Alimentação': { color: '#f59e0b', icon: <ShoppingCart size={13} /> },
    'Transporte': { color: '#3b82f6', icon: <Car size={13} /> },
    'Saúde': { color: '#10b981', icon: <Heart size={13} /> },
    'Educação': { color: '#8b5cf6', icon: <BookOpen size={13} /> },
    'Lazer': { color: '#ec4899', icon: <Gamepad2 size={13} /> },
    'Moradia': { color: '#f97316', icon: <Home size={13} /> },
    'Roupas': { color: '#06b6d4', icon: <Shirt size={13} /> },
    'Assinaturas': { color: '#6366f1', icon: <CreditCard size={13} /> },
    'Transferência': { color: '#64748b', icon: <ArrowLeftRight size={13} /> },
    'Outros': { color: '#94a3b8', icon: <MoreHorizontal size={13} /> },
}

export const cc = (c: string) => CAT[c]?.color ?? '#94a3b8'
export const ci = (c: string) => CAT[c]?.icon ?? <MoreHorizontal size={13} />
export const fmt = (v: number) => {
    const parts = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).formatToParts(v)
    return parts.map(p => p.type === 'currency' ? p.value : p.value).join('').replace('R$', 'R$ ')
}
export const h2r = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `${r},${g},${b}`
}
