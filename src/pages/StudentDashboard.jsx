import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { calcSobraPeso, calcSobraGordura, calcProgressoPercentual } from '../lib/calculations'
import VideoCard from '../components/VideoCard'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'

const WATER_GOAL_ML = 2000
const WATER_STEPS = [150, 250, 350, 500]

function Avatar({ name, size = 44 }) {
  const initials = name?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
  const colors = ['#FF5A36', '#1FD8A4', '#5B6EF5', '#F5A623', '#E91E8C']
  const color = colors[name?.charCodeAt(0) % colors.length] || '#FF5A36'
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color,
      display: 'grid', placeItems: 'center', fontWeight: 700,
      fontSize: size * 0.36, color: '#14151A', flexShrink: 0, fontFamily: 'var(--font-display)'
    }}>{initials}</div>
  )
}

export default function StudentDashboard() {
  const { profile, refreshProfile } = useAuth()
  const [tab, setTab] = useState('treinos')
  const [plans, setPlans] = useState([])
  const [videos, setVideos] = useState([])
  const [measurements, setMeasurements] = useState([])
  const [sessions, setSessions] = useState([])
  const [todayWater, setTodayWater] = useState(0)
  const [activeWorkout, setActiveWorkout] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editMedidas, setEditMedidas] = useState(false)
  const [medForm, setMedForm] = useState({ weight: '', body_fat: '' })

  useEffect(() => { if (profile) loadAll() }, [profile?.id])

  async function loadAll() {
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const [{ data: p }, { data: v }, { data: m }, { data: s }, { data: w }] = await Promise.all([
      supabase.from('workout_plans').select('*, workout_exercises(*)').or(`student_id.eq.${profile.id},student_id.is.null`).order('created_at', { ascending: false }),
      supabase.from('workout_videos').select('*').order('created_at', { ascending: false }),
      supabase.from('measurements').select('*').eq('student_id', profile.id).order('recorded_at', { ascending: true }),
      supabase.from('workout_sessions').select('*').eq('student_id', profile.id).order('completed_at', { ascending: false }),
      supabase.from('water_logs').select('amount_ml').eq('student_id', profile.id).gte('logged_at', today + 'T00:00:00'),
    ])
    setPlans(p || [])
    setVideos(v || [])
    setMeasurements(m || [])
    setSessions(s || [])
    setTodayWater((w || []).reduce((acc, r) => acc + r.amount_ml, 0))
    setLoading(false)
  }

  async function addWater(ml) {
    await supabase.from('water_logs').insert({ student_id: profile.id, amount_ml: ml })
    setTodayWater(prev => prev + ml)
  }

  async function removeWater() {
    if (todayWater <= 0) return
    const { data } = await supabase.from('water_logs').select('id,amount_ml').eq('student_id', profile.id).gte('logged_at', new Date().toISOString().slice(0, 10) + 'T00:00:00').order('logged_at', { ascending: false }).limit(1)
    if (data?.length) {
      await supabase.from('water_logs').delete().eq('id', data[0].id)
      setTodayWater(prev => Math.max(0, prev - data[0].amount_ml))
    }
  }

  async function completeWorkout(plan) {
    await supabase.from('workout_sessions').insert({ student_id: profile.id, plan_id: plan.id, plan_title: plan.title })
    setSessions(prev => [{ plan_title: plan.title, completed_at: new Date().toISOString() }, ...prev])
    setActiveWorkout(null)
    alert('🎉 Treino concluído! Ótimo trabalho!')
  }

  async function saveMedidas(e) {
    e.preventDefault()
    const weight = Number(medForm.weight)
    const body_fat = Number(medForm.body_fat)
    await supabase.from('profiles').update({ weight, body_fat }).eq('id', profile.id)
    await supabase.from('measurements').insert({ student_id: profile.id, weight, body_fat, recorded_by: profile.id })
    await refreshProfile()
    await loadAll()
    setEditMedidas(false)
  }

  const waterPct = Math.min(100, Math.round((todayWater / WATER_GOAL_ML) * 100))
  const chartData = measurements.map(m => ({
    date: new Date(m.recorded_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    peso: Number(m.weight),
    gordura: Number(m.body_fat),
  }))

  const tabs = [
    { id: 'treinos', icon: '🏋️', label: 'Treinos' },
    { id: 'evolucao', icon: '📊', label: 'Evolução' },
    { id: 'agua', icon: '💧', label: 'Água' },
    { id: 'chat', icon: '💬', label: 'Késia Chat' },
  ]

  return (
    <div className="student-shell">
      <div className="student-content">
        {/* Cabeçalho do aluno */}
        <div className="student-hero">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
            <Avatar name={profile?.name} size={52} />
            <div>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.4rem' }}>{profile?.name}</h2>
              <span className="muted" style={{ fontSize: '0.82rem' }}>{sessions.length} treinos feitos</span>
            </div>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-icon">🔥</span>
              <div>
                <strong>{sessions.length}</strong>
                <span>Treinos feitos</span>
              </div>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-icon">💧</span>
              <div>
                <strong>{waterPct}%</strong>
                <span>Hidratação</span>
              </div>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-icon">⚖️</span>
              <div>
                <strong>{profile?.weight ? `${profile.weight} kg` : '—'}</strong>
                <span>Peso atual</span>
              </div>
            </div>
          </div>
        </div>

        {/* TREINOS */}
        {tab === 'treinos' && (
          <div className="tab-content">
            {activeWorkout ? (
              <ActiveWorkout plan={activeWorkout} onComplete={completeWorkout} onCancel={() => setActiveWorkout(null)} />
            ) : (
              <>
                <div className="section-title">
                  <span>Ficha de Treinos</span>
                  <small className="muted">Prescrito pela Késia</small>
                </div>
                {loading ? <p className="muted">Carregando…</p>
                  : plans.length === 0 ? <p className="muted">Nenhum plano atribuído ainda.</p>
                  : plans.map(plan => (
                    <div key={plan.id} className="plan-card-student">
                      <div className="plan-card-student-head">
                        <div>
                          <h3>{plan.title}</h3>
                          {plan.description && <p>{plan.description}</p>}
                          <small className="muted">
                            {(plan.workout_exercises || []).length} Exercícios
                          </small>
                        </div>
                        <button className="btn-start" onClick={() => setActiveWorkout(plan)}>
                          ▶ Iniciar
                        </button>
                      </div>
                      <div className="exercise-list-preview">
                        <div className="exercise-list-label">LISTA DE EXERCÍCIOS</div>
                        {(plan.workout_exercises || []).sort((a, b) => a.position - b.position).map((ex, i) => (
                          <div key={ex.id} className="exercise-item">
                            <span className="ex-num">{i + 1}</span>
                            <div className="ex-info">
                              <strong>{ex.name}</strong>
                              <span className="muted ex-meta">
                                {[ex.sets && `${ex.sets} séries`, ex.reps && `${ex.reps} reps`, ex.rest_seconds && `Rest: ${ex.rest_seconds}s`].filter(Boolean).join(' · ')}
                              </span>
                              {ex.notes && <span className="muted ex-notes">{ex.notes}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                <div className="section-title" style={{ marginTop: '1.5rem' }}>
                  <span>Vídeos da treinadora</span>
                </div>
                {videos.length === 0 ? <p className="muted">Nenhum vídeo ainda.</p>
                  : <div className="video-grid">{videos.map(v => <VideoCard key={v.id} video={v} />)}</div>}
              </>
            )}
          </div>
        )}

        {/* EVOLUÇÃO */}
        {tab === 'evolucao' && (
          <div className="tab-content">
            <div className="section-title">
              <span>Evolução</span>
              <button className="btn-ghost" onClick={() => { setMedForm({ weight: profile.weight ?? '', body_fat: profile.body_fat ?? '' }); setEditMedidas(true) }}>
                + Registrar medida
              </button>
            </div>

            {editMedidas && (
              <form onSubmit={saveMedidas} className="form card" style={{ marginBottom: '1rem' }}>
                <div className="grid-2">
                  <label>Peso (kg)<input type="number" step="0.1" required value={medForm.weight} onChange={e => setMedForm(f => ({ ...f, weight: e.target.value }))} /></label>
                  <label>% Gordura<input type="number" step="0.1" required value={medForm.body_fat} onChange={e => setMedForm(f => ({ ...f, body_fat: e.target.value }))} /></label>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-primary" type="submit">Salvar</button>
                  <button className="btn-ghost" type="button" onClick={() => setEditMedidas(false)}>Cancelar</button>
                </div>
              </form>
            )}

            <div className="stat-grid" style={{ marginBottom: '1rem' }}>
              <div className="stat"><span className="stat-label">Peso atual</span><span className="stat-value">{profile?.weight ?? '—'} kg</span></div>
              <div className="stat"><span className="stat-label">% Gordura</span><span className="stat-value">{profile?.body_fat ?? '—'}%</span></div>
              <div className="stat"><span className="stat-label">Meta peso</span><span className="stat-value">{profile?.goal_weight ? `${profile.goal_weight} kg` : '—'}</span></div>
              <div className="stat"><span className="stat-label">Sobra</span><span className="stat-value" style={{ color: 'var(--mint)' }}>{profile?.goal_weight ? `${Math.abs(calcSobraPeso(profile.weight, profile.goal_weight))} kg` : '—'}</span></div>
            </div>

            {chartData.length >= 2 ? (
              <>
                <div className="card" style={{ marginBottom: '1rem' }}>
                  <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: 'var(--muted)' }}>PESO (kg)</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData}>
                      <CartesianGrid stroke="#2D2F3A" strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fill: '#9395A1', fontSize: 11 }} />
                      <YAxis domain={['auto', 'auto']} tick={{ fill: '#9395A1', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#20222B', border: '1px solid #2D2F3A', color: '#F5F1EA' }} />
                      {profile?.goal_weight && <ReferenceLine y={profile.goal_weight} stroke="#1FD8A4" strokeDasharray="4 4" label={{ value: 'Meta', fill: '#1FD8A4', fontSize: 11 }} />}
                      <Line type="monotone" dataKey="peso" stroke="#FF5A36" strokeWidth={2} dot={{ fill: '#FF5A36', r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="card">
                  <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: 'var(--muted)' }}>% GORDURA</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData}>
                      <CartesianGrid stroke="#2D2F3A" strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fill: '#9395A1', fontSize: 11 }} />
                      <YAxis domain={['auto', 'auto']} tick={{ fill: '#9395A1', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#20222B', border: '1px solid #2D2F3A', color: '#F5F1EA' }} />
                      {profile?.goal_body_fat && <ReferenceLine y={profile.goal_body_fat} stroke="#1FD8A4" strokeDasharray="4 4" label={{ value: 'Meta', fill: '#1FD8A4', fontSize: 11 }} />}
                      <Line type="monotone" dataKey="gordura" stroke="#1FD8A4" strokeWidth={2} dot={{ fill: '#1FD8A4', r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div className="card"><p className="muted">Registre pelo menos 2 medições para ver os gráficos de evolução.</p></div>
            )}
          </div>
        )}

        {/* ÁGUA */}
        {tab === 'agua' && (
          <div className="tab-content">
            <div className="section-title"><span>Hidratação de Hoje</span></div>
            <div className="water-card">
              <div className="water-circle-wrap">
                <svg viewBox="0 0 120 120" className="water-svg">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="#2D2F3A" strokeWidth="10" />
                  <circle cx="60" cy="60" r="52" fill="none" stroke="#5B6EF5" strokeWidth="10"
                    strokeDasharray={`${2 * Math.PI * 52}`}
                    strokeDashoffset={`${2 * Math.PI * 52 * (1 - waterPct / 100)}`}
                    strokeLinecap="round"
                    transform="rotate(-90 60 60)" />
                </svg>
                <div className="water-circle-text">
                  <strong>{waterPct}%</strong>
                  <span>{(todayWater / 1000).toFixed(2).replace('.', ',')} L</span>
                  <span className="muted">de {(WATER_GOAL_ML / 1000).toFixed(1).replace('.', ',')} L</span>
                </div>
              </div>

              <div className="water-btns">
                {WATER_STEPS.map(ml => (
                  <button key={ml} className="btn-water" onClick={() => addWater(ml)}>
                    +{ml} ml
                  </button>
                ))}
              </div>
              <button className="btn-ghost" style={{ marginTop: '0.5rem' }} onClick={removeWater}>
                ↩ Desfazer último
              </button>

              {waterPct >= 100 && (
                <div className="water-congrats">🎉 Meta diária de água atingida!</div>
              )}
            </div>
          </div>
        )}

        {/* CHAT */}
        {tab === 'chat' && <KesiaChat profile={profile} />}
      </div>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        {tabs.map(t => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

/* ── Treino Ativo ── */
function ActiveWorkout({ plan, onComplete, onCancel }) {
  const exercises = (plan.workout_exercises || []).sort((a, b) => a.position - b.position)
  const [done, setDone] = useState({})

  const allDone = exercises.length > 0 && exercises.every(ex => done[ex.id])

  return (
    <div className="active-workout">
      <div className="card-header">
        <h2>▶ {plan.title}</h2>
        <button className="btn-ghost" onClick={onCancel}>Sair</button>
      </div>
      <p className="muted">{plan.description}</p>
      <div className="exercise-list-preview">
        {exercises.map((ex, i) => (
          <div key={ex.id} className={`exercise-item ${done[ex.id] ? 'done' : ''}`}
            onClick={() => setDone(d => ({ ...d, [ex.id]: !d[ex.id] }))}>
            <span className="ex-num" style={{ background: done[ex.id] ? 'var(--mint)' : undefined }}>
              {done[ex.id] ? '✓' : i + 1}
            </span>
            <div className="ex-info">
              <strong>{ex.name}</strong>
              <span className="muted ex-meta">
                {[ex.sets && `${ex.sets} séries`, ex.reps && `${ex.reps} reps`, ex.rest_seconds && `Rest: ${ex.rest_seconds}s`].filter(Boolean).join(' · ')}
              </span>
              {ex.notes && <span className="muted ex-notes">{ex.notes}</span>}
            </div>
            <span style={{ color: done[ex.id] ? 'var(--mint)' : 'var(--muted)', fontSize: '1.2rem' }}>
              {done[ex.id] ? '✅' : '○'}
            </span>
          </div>
        ))}
      </div>
      <button className="btn-primary" style={{ width: '100%', marginTop: '1rem', opacity: allDone ? 1 : 0.5 }}
        disabled={!allDone} onClick={() => onComplete(plan)}>
        {allDone ? '🎉 Concluir Treino' : `Marque todos os ${exercises.length} exercícios`}
      </button>
    </div>
  )
}

/* ── Késia Chat ── */
function KesiaChat({ profile }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Olá, ${profile?.name?.split(' ')[0]}! 👋 Sou a assistente virtual da Késia. Pode me perguntar sobre treinos, alimentação, recuperação ou qualquer dúvida de saúde e fitness!` }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function sendMessage(e) {
    e.preventDefault()
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input.trim() }
    const newMsgs = [...messages, userMsg]
    setMessages(newMsgs)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          system: `Você é a assistente virtual da personal trainer Késia (KT Kesia Trainner). Responda de forma amigável, motivadora e direta em português brasileiro. Foque em treinos, alimentação saudável, recuperação muscular e saúde. Aluno: ${profile?.name}, Peso: ${profile?.weight}kg, % Gordura: ${profile?.body_fat}%.`,
          messages: newMsgs.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      const reply = data.content?.[0]?.text || 'Desculpe, não consegui responder agora.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro de conexão. Verifique a configuração do chat.' }])
    }
    setLoading(false)
  }

  return (
    <div className="chat-container">
      <div className="section-title"><span>💬 Késia Chat</span><small className="muted">Assistente IA</small></div>
      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble ${m.role}`}>
            {m.role === 'assistant' && <span className="chat-avatar">KT</span>}
            <div className="chat-text">{m.content}</div>
          </div>
        ))}
        {loading && (
          <div className="chat-bubble assistant">
            <span className="chat-avatar">KT</span>
            <div className="chat-text typing"><span /><span /><span /></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <form className="chat-input-row" onSubmit={sendMessage}>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Pergunte algo para a Késia…" disabled={loading} />
        <button className="btn-primary" type="submit" disabled={loading || !input.trim()}>→</button>
      </form>
    </div>
  )
}
