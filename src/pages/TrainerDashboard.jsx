import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { calcSobraPeso, calcSobraGordura } from '../lib/calculations'
import VideoCard from '../components/VideoCard'

export default function TrainerDashboard() {
  const { profile } = useAuth()
  const [students, setStudents] = useState([])
  const [selected, setSelected] = useState(null)
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [goalForm, setGoalForm] = useState({ goal_weight: '', goal_body_fat: '' })
  const [savingGoal, setSavingGoal] = useState(false)
  const [tab, setTab] = useState('alunos')

  useEffect(() => {
    loadStudents()
  }, [])

  useEffect(() => {
    if (selected) {
      setGoalForm({
        goal_weight: selected.goal_weight ?? '',
        goal_body_fat: selected.goal_body_fat ?? '',
      })
    }
  }, [selected])

  async function loadStudents() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('name')
    setStudents(data || [])
    setLoading(false)
  }

  async function loadVideos() {
    const { data } = await supabase
      .from('workout_videos')
      .select('*')
      .order('created_at', { ascending: false })
    setVideos(data || [])
  }

  useEffect(() => {
    if (tab === 'videos') loadVideos()
  }, [tab])

  async function saveGoal(e) {
    e.preventDefault()
    setSavingGoal(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        goal_weight: goalForm.goal_weight ? Number(goalForm.goal_weight) : null,
        goal_body_fat: goalForm.goal_body_fat ? Number(goalForm.goal_body_fat) : null,
      })
      .eq('id', selected.id)

    setSavingGoal(false)
    if (!error) {
      await loadStudents()
      setSelected((s) => ({
        ...s,
        goal_weight: goalForm.goal_weight ? Number(goalForm.goal_weight) : null,
        goal_body_fat: goalForm.goal_body_fat ? Number(goalForm.goal_body_fat) : null,
      }))
    }
  }

  async function deleteVideo(video) {
    if (!confirm(`Excluir o vídeo "${video.title}"?`)) return
    await supabase.storage.from('workout-videos').remove([video.storage_path])
    await supabase.from('workout_videos').delete().eq('id', video.id)
    loadVideos()
  }

  return (
    <div className="page">
      <div className="trainer-code-banner">
        <span>Seu código de treinadora (compartilhe com os alunos no cadastro):</span>
        <code>{profile.id}</code>
      </div>

      <div className="tabs">
        <button className={tab === 'alunos' ? 'active' : ''} onClick={() => setTab('alunos')}>
          Alunos
        </button>
        <button className={tab === 'videos' ? 'active' : ''} onClick={() => setTab('videos')}>
          Vídeos
        </button>
      </div>

      {tab === 'alunos' && (
        <div className="trainer-layout">
          <section className="card students-list">
            <h2>Alunos ({students.length})</h2>
            {loading ? (
              <p className="muted">Carregando…</p>
            ) : students.length === 0 ? (
              <p className="muted">
                Nenhum aluno vinculado ainda. Compartilhe seu código acima durante o cadastro deles.
              </p>
            ) : (
              <ul className="student-items">
                {students.map((s) => (
                  <li
                    key={s.id}
                    className={selected?.id === s.id ? 'selected' : ''}
                    onClick={() => setSelected(s)}
                  >
                    <span className="student-name">{s.name}</span>
                    <span className="student-meta">{s.weight ? `${s.weight} kg` : '—'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card student-detail">
            {!selected ? (
              <p className="muted">Selecione um aluno para ver detalhes e definir metas.</p>
            ) : (
              <>
                <h2>{selected.name}</h2>
                <div className="stat-grid">
                  <Stat label="Idade" value={selected.age ? `${selected.age} anos` : '—'} />
                  <Stat label="Peso atual" value={selected.weight ? `${selected.weight} kg` : '—'} />
                  <Stat label="% Gordura" value={selected.body_fat ? `${selected.body_fat}%` : '—'} />
                  <Stat
                    label="Sobra de peso"
                    value={
                      selected.goal_weight
                        ? `${calcSobraPeso(selected.weight, selected.goal_weight)} kg`
                        : '—'
                    }
                  />
                </div>

                <h3>Definir metas</h3>
                <form onSubmit={saveGoal} className="form grid-2">
                  <label>
                    Meta de peso (kg)
                    <input
                      type="number"
                      step="0.1"
                      value={goalForm.goal_weight}
                      onChange={(e) => setGoalForm((f) => ({ ...f, goal_weight: e.target.value }))}
                    />
                  </label>
                  <label>
                    Meta de % gordura
                    <input
                      type="number"
                      step="0.1"
                      value={goalForm.goal_body_fat}
                      onChange={(e) => setGoalForm((f) => ({ ...f, goal_body_fat: e.target.value }))}
                    />
                  </label>
                  <button className="btn-primary grid-span-2" type="submit" disabled={savingGoal}>
                    {savingGoal ? 'Salvando…' : 'Salvar metas'}
                  </button>
                </form>

                <UploadVideoForm
                  trainerId={profile.id}
                  studentId={selected.id}
                  studentName={selected.name}
                  onUploaded={() => tab === 'videos' && loadVideos()}
                />
              </>
            )}
          </section>
        </div>
      )}

      {tab === 'videos' && (
        <section className="card">
          <h2>Todos os vídeos</h2>
          <UploadVideoForm trainerId={profile.id} studentId={null} studentName="Todos os alunos" onUploaded={loadVideos} />
          <div className="video-grid" style={{ marginTop: '1.5rem' }}>
            {videos.map((v) => (
              <VideoCard key={v.id} video={v} onDelete={deleteVideo} />
            ))}
          </div>
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

function UploadVideoForm({ trainerId, studentId, studentName, onUploaded }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [progressMsg, setProgressMsg] = useState('')

  async function handleUpload(e) {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    setProgressMsg('Enviando vídeo…')

    const ext = file.name.split('.').pop()
    const path = `${trainerId}/${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('workout-videos')
      .upload(path, file, { cacheControl: '3600', upsert: false })

    if (uploadError) {
      setProgressMsg('Erro ao enviar vídeo. Tente novamente.')
      setUploading(false)
      return
    }

    const { error: insertError } = await supabase.from('workout_videos').insert({
      trainer_id: trainerId,
      student_id: studentId,
      title,
      description,
      storage_path: path,
    })

    setUploading(false)
    if (insertError) {
      setProgressMsg('Vídeo enviado, mas houve erro ao salvar os dados.')
      return
    }

    setProgressMsg('Vídeo enviado com sucesso!')
    setTitle('')
    setDescription('')
    setFile(null)
    onUploaded?.()
    setTimeout(() => setProgressMsg(''), 2500)
  }

  return (
    <form onSubmit={handleUpload} className="form upload-form">
      <h3>Enviar vídeo para: {studentName}</h3>
      <label>
        Título
        <input required value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        Descrição (opcional)
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </label>
      <label>
        Arquivo de vídeo
        <input type="file" accept="video/*" required onChange={(e) => setFile(e.target.files[0])} />
      </label>
      {progressMsg && <p className="form-info">{progressMsg}</p>}
      <button className="btn-primary" type="submit" disabled={uploading}>
        {uploading ? 'Enviando…' : 'Enviar vídeo'}
      </button>
    </form>
  )
}
