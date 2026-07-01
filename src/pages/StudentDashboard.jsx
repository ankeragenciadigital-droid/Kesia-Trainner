import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { calcSobraPeso, calcSobraGordura, calcProgressoPercentual } from '../lib/calculations'
import ProgressBar from '../components/ProgressBar'
import VideoCard from '../components/VideoCard'

export default function StudentDashboard() {
  const { profile, refreshProfile } = useAuth()
  const [measurements, setMeasurements] = useState([])
  const [videos, setVideos] = useState([])
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ weight: '', body_fat: '' })
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('dados')

  useEffect(() => {
    if (!profile) return
    setForm({ weight: profile.weight ?? '', body_fat: profile.body_fat ?? '' })
    loadData()
  }, [profile?.id])

  async function loadData() {
    setLoading(true)
    const [{ data: m }, { data: v }, { data: p }] = await Promise.all([
      supabase.from('measurements').select('*').eq('student_id', profile.id).order('recorded_at', { ascending: true }),
      supabase.from('workout_videos').select('*').order('created_at', { ascending: false }),
      supabase.from('workout_plans').select('*, workout_exercises(*)').eq('student_id', profile.id).order('created_at', { ascending: false }),
    ])
    setMeasurements(m || [])
    setVideos(v || [])
    setPlans(p || [])
    setLoading(false)
  }

  async function saveUpdate(e) {
    e.preventDefault()
    setSaving(true)
    const weight = Number(form.weight)
    const bodyFat = Number(form.body_fat)
    await supabase.from('profiles').update({ weight, body_fat: bodyFat }).eq('id', profile.id)
    await supabase.from('measurements').insert({ student_id: profile.id, weight, body_fat: bodyFat, recorded_by: profile.id })
    await refreshProfile()
    await loadData()
    setSaving(false)
    setEditing(false)
  }

  if (!profile) return null

  const sobraPeso = calcSobraPeso(profile.weight, profile.goal_weight)
  const sobraGordura = calcSobraGordura(profile.body_fat, profile.goal_body_fat)
  const inicial = measurements[0]
  const progressoPeso = calcProgressoPercentual(inicial?.weight, profile.weight, profile.goal_weight)
  const progressoGordura = calcProgressoPercentual(inicial?.body_fat, profile.body_fat, profile.goal_body_fat)

  return (
    <div className="page">
      <div className="tabs">
        {['dados', 'treinos', 'videos'].map(t => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t === 'dados' ? 'Meus Dados' : t === 'treinos' ? `Treinos (${plans.length})` : 'Vídeos'}
          </button>
        ))}
      </div>

      {tab === 'dados' && (
        <>
          <section className="card">
            <div className="card-header">
              <h2>Meus dados</h2>
              <button className="btn-ghost" onClick={() => setEditing(v => !v)}>
                {editing ? 'Cancelar' : 'Atualizar medidas'}
              </button>
            </div>
            {!editing ? (
              <div className="stat-grid">
                <Stat label="Nome" value={profile.name} />
                <Stat label="Idade" value={profile.age ? `${profile.age} anos` : '—'} />
                <Stat label="Peso atual" value={profile.weight ? `${profile.weight} kg` : '—'} />
                <Stat label="% Gordura" value={profile.body_fat ? `${profile.body_fat}%` : '—'} />
              </div>
            ) : (
              <form onSubmit={saveUpdate} className="form grid-2">
                <label>
                  Peso (kg)
                  <input type="number" step="0.1" required value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} />
                </label>
                <label>
                  % Gordura
                  <input type="number" step="0.1" required value={form.body_fat} onChange={e => setForm(f => ({ ...f, body_fat: e.target.value }))} />
                </label>
                <button className="btn-primary grid-span-2" type="submit" disabled={saving}>
                  {saving ? 'Salvando…' : 'Salvar nova medição'}
                </button>
              </form>
            )}
          </section>

          <section className="card">
            <h2>Progresso até a meta</h2>
            {!profile.goal_weight && !profile.goal_body_fat
              ? <p className="muted">Sua treinadora ainda não definiu metas para você.</p>
              : (
                <div className="progress-list">
                  {profile.goal_weight != null && (
                    <div className="progress-item">
                      <div className="progress-item-head">
                        <span>Peso</span>
                        <strong>
                          {sobraPeso > 0 ? `Faltam ${sobraPeso} kg`
                            : sobraPeso < 0 ? `${Math.abs(sobraPeso)} kg abaixo da meta`
                            : '🎯 Meta atingida!'}
                        </strong>
                      </div>
                      <ProgressBar percent={progressoPeso ?? 0} />
                      <small className="muted">Meta: {profile.goal_weight} kg</small>
                    </div>
                  )}
                  {profile.goal_body_fat != null && (
                    <div className="progress-item">
                      <div className="progress-item-head">
                        <span>% Gordura</span>
                        <strong>
                          {sobraGordura > 0 ? `Faltam ${sobraGordura}%`
                            : sobraGordura < 0 ? `${Math.abs(sobraGordura)}% abaixo da meta`
                            : '🎯 Meta atingida!'}
                        </strong>
                      </div>
                      <ProgressBar percent={progressoGordura ?? 0} />
                      <small className="muted">Meta: {profile.goal_body_fat}%</small>
                    </div>
                  )}
                </div>
              )}
          </section>
        </>
      )}

      {tab === 'treinos' && (
        <section className="card">
          <h2>Meus Planos de Treino</h2>
          {loading ? <p className="muted">Carregando…</p>
            : plans.length === 0 ? <p className="muted">Nenhum plano de treino atribuído ainda.</p>
            : (
              <div className="plan-list">
                {plans.map(p => (
                  <div key={p.id} className="plan-card">
                    <h3>{p.title}</h3>
                    {p.description && <p className="plan-desc">{p.description}</p>}
                    <table className="exercise-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Exercício</th>
                          <th>Séries</th>
                          <th>Reps</th>
                          <th>Descanso</th>
                          <th>Obs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(p.workout_exercises || []).sort((a, b) => a.position - b.position).map((ex, i) => (
                          <tr key={ex.id}>
                            <td>{i + 1}</td>
                            <td><strong>{ex.name}</strong></td>
                            <td>{ex.sets || '—'}</td>
                            <td>{ex.reps || '—'}</td>
                            <td>{ex.rest_seconds ? `${ex.rest_seconds}s` : '—'}</td>
                            <td className="muted">{ex.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
        </section>
      )}

      {tab === 'videos' && (
        <section className="card">
          <h2>Vídeos do treino</h2>
          {loading ? <p className="muted">Carregando…</p>
            : videos.length === 0 ? <p className="muted">Nenhum vídeo disponível ainda.</p>
            : (
              <div className="video-grid">
                {videos.map(v => <VideoCard key={v.id} video={v} />)}
              </div>
            )}
        </section>
      )}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  )
}
