import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (typeof window === 'undefined') return null
  if (_supabase) return _supabase
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  _supabase = createClient(url, key)
  return _supabase
}

// Keep named export for compatibility
export const supabase = typeof window !== 'undefined' &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  : null

export type Transacao = {
  id: string
  phone: string
  tipo: 'gasto' | 'receita'
  valor: number
  categoria: string
  descricao: string
  data: string
  criado_em: string
}
