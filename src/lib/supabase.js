import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    'Variáveis VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY não configuradas. Veja o arquivo .env.example.'
  )
}

// A "anon key" é segura para expor no front-end: ela só permite o que
// as políticas de Row Level Security (RLS) do banco autorizarem.
// A segurança real está no schema.sql, não no sigilo desta chave.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
