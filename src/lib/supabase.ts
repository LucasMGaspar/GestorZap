import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

/** Ponto único de acesso ao cliente Supabase (client-side only) */
export function getSupabase(): SupabaseClient | null {
  if (typeof window === 'undefined') return null
  if (_supabase) return _supabase
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  _supabase = createClient(url, key)
  return _supabase
}

export type Transacao = {
  id: string
  phone: string
  tipo: 'gasto' | 'receita' | 'parcela' | 'parcelado'
  valor: number
  categoria: string
  descricao: string
  data: string
  criado_em: string
  cartao_id?: string
  compra_parcelada_id?: string
}

export type Cartao = {
  id: string
  phone: string
  nome_cartao: string
  dia_fechamento: number
  dia_vencimento: number
  criado_em: string
}

export type CompraParcelada = {
  id: string
  phone: string
  descricao: string
  valor_total: number
  n_parcelas: number
  valor_parcela: number
  categoria: string
  data_inicio: string
  ativa: boolean
  criado_em: string
  cartao_id?: string
}

export type Budget = {
  id?: string
  phone: string
  categoria: string
  valor: number
}

/*
  SQL para criar a tabela de orçamentos no Supabase (execute uma vez no SQL Editor):

  CREATE TABLE IF NOT EXISTS budgets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    phone text NOT NULL,
    categoria text NOT NULL,
    valor numeric NOT NULL,
    criado_em timestamptz DEFAULT now(),
    UNIQUE(phone, categoria)
  );
  ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
*/
