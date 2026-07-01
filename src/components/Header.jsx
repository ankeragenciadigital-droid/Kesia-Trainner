import { useAuth } from '../context/AuthContext'

export default function Header() {
  const { profile, signOut } = useAuth()

  return (
    <header className="app-header">
      <div className="brand brand-sm">
        <span className="brand-mark">KT</span>
        <span>KT Kesia Trainner</span>
      </div>
      <div className="header-right">
        <span className="header-name">{profile?.name}</span>
        <button className="btn-ghost" onClick={signOut}>
          Sair
        </button>
      </div>
    </header>
  )
}
