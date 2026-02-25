import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

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
