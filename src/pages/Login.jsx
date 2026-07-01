import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await signIn({ email, password })
    setBusy(false)
    if (error) {
      setError('E-mail ou senha incorretos.')
      return
    }
    navigate('/')
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="brand">
          <span className="brand-mark">KT</span>
          <div>
            <h1>KT Kesia Trainner</h1>
            <p>Acompanhamento de treino, sob medida.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="form">
          <label>
            E-mail
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="auth-switch">
          Ainda não tem conta? <Link to="/cadastro">Criar conta</Link>
        </p>
      </div>
    </div>
  )
}
