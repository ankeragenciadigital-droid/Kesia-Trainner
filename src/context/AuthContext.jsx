import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); return }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) { console.error('Erro ao carregar perfil:', error.message); setProfile(null) }
    else { setProfile(data) }
  }, [])

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      setSession(session)
      if (session?.user) await loadProfile(session.user.id)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session?.user) { await loadProfile(session.user.id) }
      else { setProfile(null) }
    })
    return () => { mounted = false; listener.subscription.unsubscribe() }
  }, [loadProfile])

  const signUp = async ({ email, password, name, role, age, weight, bodyFat, trainerId }) => {
    // Dados passados como metadata — a trigger handle_new_user() no banco
    // cria o perfil com SECURITY DEFINER, evitando erro 401 do RLS
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role,
          age: age ? String(age) : '',
          weight: weight ? String(weight) : '',
          body_fat: bodyFat ? String(bodyFat) : '',
          trainer_id: role === 'student' && trainerId ? trainerId : '',
        },
      },
    })
    if (error) return { error }
    const userId = data.user?.id
    if (userId) {
      // Aguarda um momento para a trigger executar antes de buscar o perfil
      await new Promise((r) => setTimeout(r, 800))
      await loadProfile(userId)
    }
    return { error: null }
  }

  const signIn = async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setSession(null)
  }

  const refreshProfile = () => loadProfile(session?.user?.id)

  return (
    <AuthContext.Provider value={{ session, profile, loading, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
