import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { calcSobraPeso, calcSobraGordura } from '../lib/calculations'
import VideoCard from '../components/VideoCard'

export default function TrainerDashboard() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('alunos')
  const [students, setStudents] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadStudents() }, [])

  async function loadStudents() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .eq('trainer_id', profile.id)
      .order('name')
    setStudents(data || [])
    setLoading(false)
  }

  function refreshSelected(updated) {
    setSelected(updated)
    setStudents(s => s.map(x => x.id === updated.id ? updated : x))
  }

  return (
    <div className="page">
      <div className="trainer-code-banner">
        <span>Seu código (envie para os alunos cadastrarem):</span>
        <code onClick={() => navigator.clipboard?.writeText(profile.id)} title="Clique para copiar">
          {profile.id} 📋
        </code>
      </div>

      <div className="tabs">
        {['alunos', 'treinos', 'videos'].map(t => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t === 'alunos' ? `Alunos (${students.length})` : t === 'treinos' ? 'Planos de Treino' : 'Vídeos'}
          </button>
        ))}
      </div>

      {tab === 'alunos' && (
        <div className="trainer-layout">
          <section className="card students-list">
            <h2>Alunos</h2>
            {loading ? <p className="muted">Carregando…</p>
              : students.length === 0 ? <p className="muted">Nenhum aluno vinculado. Compartilhe seu código acima.</p>
              : (
                <ul className="student-items">
                  {students.map(s => (
                    <li key={s.id} className={selected?.id === s.id ? 'selected' : ''} onClick={() => setSelected(s)}>
                      <span className="student-name">{s.name}</span>
                      <span className="student-meta">{s.weight ? `${s.weight} kg` : '—'}</span>
                    </li>
                  ))}
                </ul>
              )}
          </section>

          <section className="card student-detail">
            {!selected
              ? <p className="muted">Selecione um aluno para ver detalhes.</p>
              : <StudentDetail student={selected} trainerId={profile.id} onUpdate={refreshSelected} />
            }
          </section>
        </div>
      )}

      {tab === 'treinos' && <PlansTab trainerId={profile.id} students={students} />}
      {tab === 'videos' && <VideosTab trainerId={profile.id} students={students} />}
    </div>
  )
}

/* ── Detalhe do aluno ── */
function StudentDetail({ student, trainerId, onUpdate }) {
  const [goalForm, setGoalForm] = useState({
    goal_weight: student.goal_weight ?? '',
    goal_body_fat: student.goal_body_fat ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setGoalForm({ goal_weight: student.goal_weight ?? '', goal_body_fat: student.goal_body_fat ?? '' })
  }, [student.id])

  async function saveGoal(e) {
    e.preventDefault()
    setSaving(true)
    const update = {
      goal_weight: goalForm.goal_weight !== '' ? Number(goalForm.goal_weight) : null,
      goal_body_fat: goalForm.goal_body_fat !== '' ? Number(goalForm.goal_body_fat) : null,
    }
    const { error } = await supabase.from('profiles').update(update).eq('id', student.id)
    setSaving(false)
    if (!error) {
      setMsg('Metas salvas!')
      onUpdate({ ...student, ...update })
      setTimeout(() => setMsg(''), 2000)
    }
  }

  const sobraPeso = calcSobraPeso(student.weight, student.goal_weight)
  const sobraGordura = calcSobraGordura(student.body_fat, student.goal_body_fat)

  return (
    <>
      <h2>{student.name}</h2>
      <div className="stat-grid">
        <Stat label="Idade" value={student.age ? `${student.age} anos` : '—'} />
        <Stat label="Peso atual" value={student.weight ? `${student.weight} kg` : '—'} />
        <Stat label="% Gordura" value={student.body_fat ? `${student.body_fat}%` : '—'} />
        <Stat label="Sobra de peso" value={sobraPeso != null ? `${sobraPeso > 0 ? '-' : '+'}${Math.abs(sobraPeso)} kg` : '—'} />
      </div>

      {student.goal_body_fat && (
        <div className="detail-row">
          <span className="muted">Sobra de gordura:</span>
          <strong>{sobraGordura != null ? `${sobraGordura > 0 ? 'Faltam ' : ''}${Math.abs(sobraGordura)}%` : '—'}</strong>
        </div>
      )}

      <h3>Definir metas</h3>
      <form onSubmit={saveGoal} className="form grid-2">
        <label>
          Meta peso (kg)
          <input type="number" step="0.1" value={goalForm.goal_weight}
            onChange={e => setGoalForm(f => ({ ...f, goal_weight: e.target.value }))} />
        </label>
        <label>
          Meta % gordura
          <input type="number" step="0.1" value={goalForm.goal_body_fat}
            onChange={e => setGoalForm(f => ({ ...f, goal_body_fat: e.target.value }))} />
        </label>
        {msg && <p className="form-info grid-span-2">{msg}</p>}
        <button className="btn-primary grid-span-2" type="submit" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar metas'}
        </button>
      </form>
    </>
  )
}

/* ── Planos de treino ── */
function PlansTab({ trainerId, students }) {
  const [plans, setPlans] = useState([])
  const [editing, setEditing] = useState(null) // null | 'new' | plan object
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadPlans() }, [])

  async function loadPlans() {
    setLoading(true)
    const { data } = await supabase
      .from('workout_plans')
      .select('*, workout_exercises(*)')
      .eq('trainer_id', trainerId)
      .order('created_at', { ascending: false })
    setPlans(data || [])
    setLoading(false)
  }

  async function deletePlan(id) {
    if (!confirm('Excluir este plano?')) return
    await supabase.from('workout_plans').delete().eq('id', id)
    loadPlans()
  }

  if (editing !== null) {
    return (
      <PlanEditor
        plan={editing === 'new' ? null : editing}
        trainerId={trainerId}
        students={students}
        onSave={() => { setEditing(null); loadPlans() }}
        onCancel={() => setEditing(null)}
      />
    )
  }

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
                      <span className="muted">{student ? `Aluno: ${student.name}` : 'Todos os alunos'}</span>
                    </div>
                    <div className="plan-actions">
                      <button className="btn-ghost" onClick={() => setEditing(p)}>Editar</button>
                      <button className="btn-ghost danger" onClick={() => deletePlan(p.id)}>Excluir</button>
                    </div>
                  </div>
                  {p.description && <p className="plan-desc">{p.description}</p>}
                  <div className="exercise-chips">
                    {(p.workout_exercises || [])
                      .sort((a, b) => a.position - b.position)
                      .map(ex => (
                        <span key={ex.id} className="chip">
                          {ex.name}{ex.sets ? ` · ${ex.sets}x${ex.reps || '?'}` : ''}
                        </span>
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

/* ── Editor de plano ── */
function PlanEditor({ plan, trainerId, students, onSave, onCancel }) {
  const [title, setTitle] = useState(plan?.title || '')
  const [description, setDescription] = useState(plan?.description || '')
  const [studentId, setStudentId] = useState(plan?.student_id || '')
  const [exercises, setExercises] = useState(
    plan?.workout_exercises?.sort((a, b) => a.position - b.position) || []
  )
  const [saving, setSaving] = useState(false)

  function addExercise() {
    setExercises(ex => [...ex, { id: crypto.randomUUID(), name: '', sets: '', reps: '', rest_seconds: '', notes: '', position: ex.length, _new: true }])
  }

  function updateEx(id, field, val) {
    setExercises(ex => ex.map(e => e.id === id ? { ...e, [field]: val } : e))
  }

  function removeEx(id) {
    setExercises(ex => ex.filter(e => e.id !== id))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)

    let planId = plan?.id
    const planData = {
      trainer_id: trainerId,
      student_id: studentId || null,
      title: title.trim(),
      description: description.trim() || null,
    }

    if (planId) {
      await supabase.from('workout_plans').update(planData).eq('id', planId)
      await supabase.from('workout_exercises').delete().eq('plan_id', planId)
    } else {
      const { data } = await supabase.from('workout_plans').insert(planData).select().single()
      planId = data.id
    }

    if (exercises.length > 0) {
      await supabase.from('workout_exercises').insert(
        exercises.map((ex, i) => ({
          plan_id: planId,
          name: ex.name,
          sets: ex.sets ? Number(ex.sets) : null,
          reps: ex.reps || null,
          rest_seconds: ex.rest_seconds ? Number(ex.rest_seconds) : null,
          notes: ex.notes || null,
          position: i,
        }))
      )
    }

    setSaving(false)
    onSave()
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>{plan ? 'Editar plano' : 'Novo plano de treino'}</h2>
        <button className="btn-ghost" onClick={onCancel}>Cancelar</button>
      </div>
      <form onSubmit={handleSave} className="form">
        <label>
          Título do plano *
          <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Treino A – Peito e Tríceps" />
        </label>
        <label>
          Descrição (opcional)
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Instruções gerais, frequência, etc." />
        </label>
        <label>
          Aluno
          <select value={studentId} onChange={e => setStudentId(e.target.value)}>
            <option value="">Todos os alunos</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>

        <div className="exercises-header">
          <h3 style={{ margin: 0 }}>Exercícios</h3>
          <button type="button" className="btn-ghost" onClick={addExercise}>+ Adicionar exercício</button>
        </div>

        {exercises.length === 0 && <p className="muted">Nenhum exercício ainda. Clique em "+ Adicionar".</p>}

        {exercises.map((ex, i) => (
          <div key={ex.id} className="exercise-row">
            <div className="exercise-row-head">
              <span className="exercise-num">{i + 1}</span>
              <button type="button" className="btn-ghost danger sm" onClick={() => removeEx(ex.id)}>✕</button>
            </div>
            <div className="grid-2">
              <label className="grid-span-2">
                Nome do exercício *
                <input required value={ex.name} onChange={e => updateEx(ex.id, 'name', e.target.value)} placeholder="Ex: Supino Reto" />
              </label>
              <label>
                Séries
                <input type="number" min="1" value={ex.sets} onChange={e => updateEx(ex.id, 'sets', e.target.value)} placeholder="Ex: 4" />
              </label>
              <label>
                Repetições
                <input value={ex.reps} onChange={e => updateEx(ex.id, 'reps', e.target.value)} placeholder="Ex: 12 ou 8-12" />
              </label>
              <label>
                Descanso (seg)
                <input type="number" value={ex.rest_seconds} onChange={e => updateEx(ex.id, 'rest_seconds', e.target.value)} placeholder="Ex: 60" />
              </label>
              <label>
                Observações
                <input value={ex.notes} onChange={e => updateEx(ex.id, 'notes', e.target.value)} placeholder="Cadência, variação, etc." />
              </label>
            </div>
          </div>
        ))}

        <button className="btn-primary" type="submit" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar plano'}
        </button>
      </form>
    </section>
  )
}

/* ── Vídeos ── */
function VideosTab({ trainerId, students }) {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadVideos() }, [])

  async function loadVideos() {
    setLoading(true)
    const { data } = await supabase.from('workout_videos').select('*').eq('trainer_id', trainerId).order('created_at', { ascending: false })
    setVideos(data || [])
    setLoading(false)
  }

  async function deleteVideo(video) {
    if (!confirm(`Excluir o vídeo "${video.title}"?`)) return
    await supabase.storage.from('workout-videos').remove([video.storage_path])
    await supabase.from('workout_videos').delete().eq('id', video.id)
    loadVideos()
  }

  return (
    <section className="card">
      <h2>Vídeos de Treino</h2>
      <UploadVideoForm trainerId={trainerId} students={students} onUploaded={loadVideos} />
      {loading ? <p className="muted" style={{ marginTop: '1rem' }}>Carregando…</p>
        : videos.length === 0 ? <p className="muted" style={{ marginTop: '1rem' }}>Nenhum vídeo enviado ainda.</p>
        : (
          <div className="video-grid" style={{ marginTop: '1.5rem' }}>
            {videos.map(v => {
              const student = students.find(s => s.id === v.student_id)
              return (
                <div key={v.id}>
                  {student && <small className="muted">Para: {student.name}</small>}
                  <VideoCard video={v} onDelete={deleteVideo} />
                </div>
              )
            })}
          </div>
        )}
    </section>
  )
}

function UploadVideoForm({ trainerId, students, onUploaded }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [studentId, setStudentId] = useState('')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')

  async function handleUpload(e) {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    setMsg('Enviando vídeo…')
    const ext = file.name.split('.').pop()
    const path = `${trainerId}/${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('workout-videos').upload(path, file, { cacheControl: '3600', upsert: false })
    if (uploadError) { setMsg('Erro ao enviar.'); setUploading(false); return }
    await supabase.from('workout_videos').insert({ trainer_id: trainerId, student_id: studentId || null, title, description, storage_path: path })
    setUploading(false)
    setMsg('Enviado!')
    setTitle(''); setDescription(''); setStudentId(''); setFile(null)
    onUploaded?.()
    setTimeout(() => setMsg(''), 2500)
  }

  return (
    <form onSubmit={handleUpload} className="form">
      <h3>Enviar novo vídeo</h3>
      <div className="grid-2">
        <label>
          Título *
          <input required value={title} onChange={e => setTitle(e.target.value)} />
        </label>
        <label>
          Para o aluno
          <select value={studentId} onChange={e => setStudentId(e.target.value)}>
            <option value="">Todos os alunos</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      </div>
      <label>
        Descrição
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
      </label>
      <label>
        Arquivo de vídeo *
        <input type="file" accept="video/*" required onChange={e => setFile(e.target.files[0])} />
      </label>
      {msg && <p className="form-info">{msg}</p>}
      <button className="btn-primary" type="submit" disabled={uploading} style={{ width: 'fit-content' }}>
        {uploading ? 'Enviando…' : 'Enviar vídeo'}
      </button>
    </form>
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
