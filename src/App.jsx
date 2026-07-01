import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Signup from './pages/Signup'
import StudentDashboard from './pages/StudentDashboard'
import TrainerDashboard from './pages/TrainerDashboard'
import Header from './components/Header'

export default function App() {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="splash">
        <span className="brand-mark big">KT</span>
        <p>Carregando…</p>
      </div>
    )
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Signup />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  if (!profile) {
    return (
      <div className="splash">
        <p>Não foi possível carregar seu perfil. Tente sair e entrar novamente.</p>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Header />
      <main>
        <Routes>
          <Route
            path="/"
            element={profile.role === 'trainer' ? <TrainerDashboard /> : <StudentDashboard />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
