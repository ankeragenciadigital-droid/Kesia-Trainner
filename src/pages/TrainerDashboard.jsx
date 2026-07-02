import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { calcSobraPeso, calcSobraGordura } from '../lib/calculations'
import VideoCard from '../components/VideoCard'

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

export default function TrainerDashboard() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('alunos')
  const [students, setStudents] = useState([])
  const [selected, setSelected] = useState(null)
  const [sessionCounts, setSessionCounts] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadStudents() }, [])

  async function loadStudents() {
    setLoading(true)
    const { data: s } = await supabase.from('profiles').select('*').eq('role', 'student').eq('trainer_id', profile.id).order('name')
    const students = s || []
    setStudents(students)

    if (students.length > 0) {
      const ids = students.map(x => x.id)
      const { data: sess } = await supabase.from('workout_sessions').select('student_id').in('student_id', ids)
      const counts = {}
      ;(sess || []).forEach(r => { counts[r.student_id] = (counts[r.student_id] || 0) + 1 })
      setSessionCounts(counts)
    }
    setLoading(false)
  }

  return (
    <div className="page">
      <div className="trainer-code-banner">
        <span>Seu código de treinadora:</span>
        <code onClick={() => { navigator.clipboard?.writeText(profile.id); alert('Código copiado!') }} title="Clique para copiar">
          {profile.id} 📋
        </code>
      </div>

      <div className="tabs">
        {[['alunos', `Alunos (${students.length})`], ['treinos', 'Planos de Treino'], ['videos', 'Vídeos']].map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'alunos' && (
        <>
          {/* Cards de alunos */}
          {students.length > 0 && (
            <div className="student-cards-scroll">
              {students.map(s => (
                <div key={s.id} className={`student-card-select ${selected?.id === s.id ? 'active' : ''}`} onClick={() => setSelected(s)}>
                  <Avatar name={s.name} size={48} />
                  <div className="student-card-info">
                    <strong>{s.name}</strong>
                    <span className="muted">{s.goal_weight ? `Meta: ${s.goal_weight} kg` : 'Sem meta'}</span>
                    <span className="chip" style={{ width: 'fit-content', marginTop: '0.25rem' }}>🔥 {sessionCounts[s.id] || 0} treinos</span>
                  </div>
                  {selected?.id === s.id && <span className="selected-dot" />}
                </div>
              ))}
            </div>
          )}

          <div className="trainer-layout">
            <section className="card students-list">
              <h2>Alunos</h2>
              {loading ? <p className="muted">Carregando…</p>
                : students.length === 0
                  ? <p className="muted">Nenhum aluno vinculado. Compartilhe seu código acima.</p>
                  : (
                    <ul className="student-items">
                      {students.map(s => (
                        <li key={s.id} className={selected?.id === s.id ? 'selected' : ''} onClick={() => setSelected(s)}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <Avatar name={s.name} size={32} />
                            <div>
                              <div className="student-name">{s.name}</div>
                              <div className="student-meta">{sessionCounts[s.id] || 0} treinos</div>
                            </div>
                          </div>
                          <span className="student-meta">{s.weight ? `${s.weight} kg` : '—'}</span>
                        </li>
                      ))}
                    </ul>
                  )}
            </section>

            <section className="card student-detail">
              {!selected
                ? <p className="muted">Selecione um aluno para ver detalhes e definir metas.</p>
                : <StudentDetail key={selected.id} student={selected} onUpdate={s => { setSelected(s); setStudents(prev => prev.map(x => x.id === s.id ? s : x)) }} />
              }
            </section>
          </div>
        </>
      )}

      {tab === 'treinos' && <PlansTab trainerId={profile.id} students={students} />}
      {tab === 'videos' && <VideosTab trainerId={profile.id} students={students} />}
    </div>
  )
}

function StudentDetail({ student, onUpdate }) {
  const [form, setForm] = useState({ goal_weight: student.goal_weight ?? '', goal_body_fat: student.goal_body_fat ?? '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    const update = {
      goal_weight: form.goal_weight !== '' ? Number(form.goal_weight) : null,
      goal_body_fat: form.goal_body_fat !== '' ? Number(form.goal_body_fat) : null,
    }
    await supabase.from('profiles').update(update).eq('id', student.id)
    setSaving(false)
    setMsg('✅ Metas salvas!')
    onUpdate({ ...student, ...update })
    setTimeout(() => setMsg(''), 2000)
  }

  const sobraPeso = calcSobraPeso(student.weight, student.goal_weight)
  const sobraGordura = calcSobraGordura(student.body_fat, student.goal_body_fat)

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <Avatar name={student.name} size={52} />
        <div>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.4rem' }}>{student.name}</h2>
          <span className="muted" style={{ fontSize: '0.82rem' }}>{student.age ? `${student.age} anos` : ''}</span>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat"><span className="stat-label">Peso atual</span><span className="stat-value">{student.weight ? `${student.weight} kg` : '—'}</span></div>
        <div className="stat"><span className="stat-label">% Gordura</span><span className="stat-value">{student.body_fat ? `${student.body_fat}%` : '—'}</span></div>
        <div className="stat"><span className="stat-label">Sobra peso</span><span className="stat-value" style={{ color: 'var(--mint)' }}>{sobraPeso != null ? `${sobraPeso > 0 ? sobraPeso : '✓'} ${sobraPeso > 0 ? 'kg' : ''}` : '—'}</span></div>
        <div className="stat"><span className="stat-label">Sobra gordura</span><span className="stat-value" style={{ color: 'var(--mint)' }}>{sobraGordura != null ? `${sobraGordura > 0 ? sobraGordura : '✓'} ${sobraGordura > 0 ? '%' : ''}` : '—'}</span></div>
      </div>

      <h3 style={{ margin: '1.25rem 0 0.75rem', fontSize: '0.9rem', color: 'var(--muted)' }}>DEFINIR METAS</h3>
      <form onSubmit={save} className="form grid-2">
        <label>Meta peso (kg)<input type="number" step="0.1" value={form.goal_weight} onChange={e => setForm(f => ({ ...f, goal_weight: e.target.value }))} /></label>
        <label>Meta % gordura<input type="number" step="0.1" value={form.goal_body_fat} onChange={e => setForm(f => ({ ...f, goal_body_fat: e.target.value }))} /></label>
        {msg && <p className="form-info grid-span-2">{msg}</p>}
        <button className="btn-primary grid-span-2" type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar metas'}</button>
      </form>
    </>
  )
}

function PlansTab({ trainerId, students }) {
  const [plans, setPlans] = useState([])
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('workout_plans').select('*, workout_exercises(*)').eq('trainer_id', trainerId).order('created_at', { ascending: false })
    setPlans(data || [])
    setLoading(false)
  }

  if (editing !== null) return <PlanEditor plan={editing === 'new' ? null : editing} trainerId={trainerId} students={students} onSave={() => { setEditing(null); load() }} onCancel={() => setEditing(null)} />

  return (
    <section className="card">
      <div className="card-header">
        <h2>Planos de Treino</h2>
        <button className="btn-primary" onClick={() => setEditing('new')}>+ Novo plano</button>
      </div>
      {loading ? <p className="muted">Carregando…</p>
        : plans.length === 0 ? <p className="muted">Nenhum plano criado ainda.</p>
        : (
          <div className="plan-list">
            {plans.map(p => {
              const student = students.find(s => s.id === p.student_id)
              return (
                <div key={p.id} className="plan-card">
                  <div className="plan-card-head">
                    <div>
                      <h3>{p.title}</h3>
                      <span className="muted">{student ? `👤 ${student.name}` : '👥 Todos os alunos'}</span>
                    </div>
                    <div className="plan-actions">
                      <button className="btn-ghost" onClick={() => setEditing(p)}>Editar</button>
                      <button className="btn-ghost danger" onClick={async () => { if (!confirm('Excluir?')) return; await supabase.from('workout_plans').delete().eq('id', p.id); load() }}>Excluir</button>
                    </div>
                  </div>
                  {p.description && <p className="plan-desc">{p.description}</p>}
                  <div className="exercise-chips">
                    {(p.workout_exercises || []).sort((a, b) => a.position - b.position).map(ex => (
                      <span key={ex.id} className="chip">{ex.name}{ex.sets ? ` · ${ex.sets}x${ex.reps || '?'}` : ''}</span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
    </section>
  )
}

function PlanEditor({ plan, trainerId, students, onSave, onCancel }) {
  const [title, setTitle] = useState(plan?.title || '')
  const [description, setDescription] = useState(plan?.description || '')
  const [studentId, setStudentId] = useState(plan?.student_id || '')
  const [exercises, setExercises] = useState(plan?.workout_exercises?.sort((a, b) => a.position - b.position) || [])
  const [saving, setSaving] = useState(false)

  function addEx() { setExercises(ex => [...ex, { id: crypto.randomUUID(), name: '', sets: '', reps: '', rest_seconds: '', notes: '', position: ex.length }]) }
  function updEx(id, f, v) { setExercises(ex => ex.map(e => e.id === id ? { ...e, [f]: v } : e)) }
  function remEx(id) { setExercises(ex => ex.filter(e => e.id !== id)) }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    let planId = plan?.id
    const planData = { trainer_id: trainerId, student_id: studentId || null, title: title.trim(), description: description.trim() || null }
    if (planId) { await supabase.from('workout_plans').update(planData).eq('id', planId); await supabase.from('workout_exercises').delete().eq('plan_id', planId) }
    else { const { data } = await supabase.from('workout_plans').insert(planData).select().single(); planId = data.id }
    if (exercises.length > 0) {
      await supabase.from('workout_exercises').insert(exercises.map((ex, i) => ({ plan_id: planId, name: ex.name, sets: ex.sets ? Number(ex.sets) : null, reps: ex.reps || null, rest_seconds: ex.rest_seconds ? Number(ex.rest_seconds) : null, notes: ex.notes || null, position: i })))
    }
    setSaving(false)
    onSave()
  }

  return (
    <section className="card">
      <div className="card-header"><h2>{plan ? 'Editar plano' : 'Novo plano'}</h2><button className="btn-ghost" onClick={onCancel}>Cancelar</button></div>
      <form onSubmit={save} className="form">
        <label>Título *<input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Treino A – Peito e Tríceps" /></label>
        <label>Descrição<textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} /></label>
        <label>Aluno
          <select value={studentId} onChange={e => setStudentId(e.target.value)}>
            <option value="">Todos os alunos</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <div className="exercises-header">
          <h3 style={{ margin: 0 }}>Exercícios</h3>
          <button type="button" className="btn-ghost" onClick={addEx}>+ Adicionar</button>
        </div>
        {exercises.length === 0 && <p className="muted">Clique em "+ Adicionar" para incluir exercícios.</p>}
        {exercises.map((ex, i) => (
          <div key={ex.id} className="exercise-row">
            <div className="exercise-row-head">
              <span className="exercise-num">{i + 1}</span>
              <button type="button" className="btn-ghost danger sm" onClick={() => remEx(ex.id)}>✕</button>
            </div>
            <div className="grid-2">
              <label className="grid-span-2">Nome *<input required value={ex.name} onChange={e => updEx(ex.id, 'name', e.target.value)} placeholder="Ex: Supino Reto" /></label>
              <label>Séries<input type="number" min="1" value={ex.sets} onChange={e => updEx(ex.id, 'sets', e.target.value)} placeholder="4" /></label>
              <label>Repetições<input value={ex.reps} onChange={e => updEx(ex.id, 'reps', e.target.value)} placeholder="8-12" /></label>
              <label>Descanso (seg)<input type="number" value={ex.rest_seconds} onChange={e => updEx(ex.id, 'rest_seconds', e.target.value)} placeholder="60" /></label>
              <label>Observações<input value={ex.notes} onChange={e => updEx(ex.id, 'notes', e.target.value)} placeholder="Cadência, variação…" /></label>
            </div>
          </div>
        ))}
        <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar plano'}</button>
      </form>
    </section>
  )
}

function VideosTab({ trainerId, students }) {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [studentId, setStudentId] = useState('')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('workout_videos').select('*').eq('trainer_id', trainerId).order('created_at', { ascending: false })
    setVideos(data || [])
    setLoading(false)
  }

  async function upload(e) {
    e.preventDefault()
    if (!file) return
    setUploading(true); setMsg('Enviando…')
    const path = `${trainerId}/${crypto.randomUUID()}.${file.name.split('.').pop()}`
    const { error } = await supabase.storage.from('workout-videos').upload(path, file, { cacheControl: '3600', upsert: false })
    if (error) { setMsg('Erro ao enviar.'); setUploading(false); return }
    await supabase.from('workout_videos').insert({ trainer_id: trainerId, student_id: studentId || null, title, description, storage_path: path })
    setUploading(false); setMsg('Enviado!'); setTitle(''); setDescription(''); setStudentId(''); setFile(null)
    load(); setTimeout(() => setMsg(''), 2500)
  }

  return (
    <section className="card">
      <h2>Vídeos de Treino</h2>
      <form onSubmit={upload} className="form">
        <h3>Enviar novo vídeo</h3>
        <div className="grid-2">
          <label>Título *<input required value={title} onChange={e => setTitle(e.target.value)} /></label>
          <label>Para o aluno
            <select value={studentId} onChange={e => setStudentId(e.target.value)}>
              <option value="">Todos os alunos</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        </div>
        <label>Descrição<textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} /></label>
        <label>Arquivo de vídeo *<input type="file" accept="video/*" required onChange={e => setFile(e.target.files[0])} /></label>
        {msg && <p className="form-info">{msg}</p>}
        <button className="btn-primary" type="submit" disabled={uploading} style={{ width: 'fit-content' }}>{uploading ? 'Enviando…' : 'Enviar vídeo'}</button>
      </form>
      <div className="video-grid" style={{ marginTop: '1.5rem' }}>
        {loading ? <p className="muted">Carregando…</p>
          : videos.map(v => {
            const student = students.find(s => s.id === v.student_id)
            return <div key={v.id}>{student && <small className="muted">Para: {student.name}</small>}<VideoCard video={v} onDelete={async () => { if (!confirm('Excluir?')) return; await supabase.storage.from('workout-videos').remove([v.storage_path]); await supabase.from('workout_videos').delete().eq('id', v.id); load() }} /></div>
          })}
      </div>
    </section>
  )
}
