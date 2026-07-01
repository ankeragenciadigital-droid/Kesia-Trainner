import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [role, setRole] = useState('student')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [age, setAge] = useState('')
  const [weight, setWeight] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [trainerCode, setTrainerCode] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)

    const { error } = await signUp({
      email,
      password,
      name,
      role,
      age: age ? Number(age) : null,
      weight: weight ? Number(weight) : null,
      bodyFat: bodyFat ? Number(bodyFat) : null,
      trainerId: role === 'student' ? trainerCode.trim() || null : null,
    })

    setBusy(false)

    if (error) {
      setError(error.message?.includes('confirme')
        ? error.message
        : 'Não foi possível criar a conta. Verifique os dados e tente novamente.')
      return
    }

    setInfo('Conta criada! Verifique seu e-mail para confirmar o cadastro, se necessário.')
    setTimeout(() => navigate('/'), 1200)
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="brand">
          <span className="brand-mark">KT</span>
          <div>
            <h1>Criar conta</h1>
            <p>KT Kesia Trainner</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="form">
          <div className="role-toggle">
            <button
              type="button"
              className={role === 'student' ? 'active' : ''}
              onClick={() => setRole('student')}
            >
              Sou aluno(a)
            </button>
            <button
              type="button"
              className={role === 'trainer' ? 'active' : ''}
              onClick={() => setRole('trainer')}
            >
              Sou treinadora
            </button>
          </div>

          <label>
            Nome
            <input required value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <label>
            E-mail
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>

          <label>
            Senha
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <div className="grid-2">
            <label>
              Idade
              <input type="number" min="5" max="120" value={age} onChange={(e) => setAge(e.target.value)} />
            </label>
            <label>
              Peso (kg)
              <input type="number" step="0.1" min="0" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </label>
          </div>

          <label>
            % de gordura corporal
            <input type="number" step="0.1" min="0" max="100" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} />
          </label>

          {role === 'student' && (
            <label>
              Código da treinadora (opcional)
              <input
                value={trainerCode}
                onChange={(e) => setTrainerCode(e.target.value)}
                placeholder="Cole aqui o ID que a Kesia te enviou"
              />
              <small>A treinadora encontra esse código no painel dela e pode te enviar por mensagem.</small>
            </label>
          )}

          {error && <p className="form-error">{error}</p>}
          {info && <p className="form-info">{info}</p>}

          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? 'Criando conta…' : 'Criar conta'}
          </button>
        </form>

        <p className="auth-switch">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </div>
    </div>
  )
}
