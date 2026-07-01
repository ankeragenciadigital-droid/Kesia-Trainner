import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()   // retorna null em vez de erro 406 quando não há linha
    if (error) {
      console.error('Erro ao carregar perfil:', error.message)
      setProfile(null)
    } else {
      setProfile(data) // null se não existir perfil ainda
    }
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
      if (session?.user) {
        await loadProfile(session.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signUp = async ({ email, password, name, role, age, weight, bodyFat, trainerId }) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error }

    const userId = data.user?.id
    if (!userId) return { error: { message: 'Confirme seu e-mail para continuar.' } }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      role,
      name,
      age: age || null,
      weight: weight || null,
      body_fat: bodyFat || null,
      trainer_id: role === 'student' ? trainerId || null : null,
    })
    if (profileError) return { error: profileError }

    await loadProfile(userId)
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
    <AuthContext.Provider
      value={{ session, profile, loading, signUp, signIn, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
