import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function VideoCard({ video, onDelete }) {
  const [url, setUrl] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    async function getUrl() {
      const { data, error } = await supabase.storage
        .from('workout-videos')
        .createSignedUrl(video.storage_path, 60 * 60) // expira em 1h
      if (!active) return
      if (error) {
        setError(true)
      } else {
        setUrl(data.signedUrl)
      }
    }
    getUrl()
    return () => {
      active = false
    }
  }, [video.storage_path])

  return (
    <div className="video-card">
      {error ? (
        <div className="video-error">Não foi possível carregar este vídeo.</div>
      ) : url ? (
        <video controls preload="metadata" src={url} />
      ) : (
        <div className="video-skeleton" />
      )}
      <div className="video-info">
        <h3>{video.title}</h3>
        {video.description && <p>{video.description}</p>}
      </div>
      {onDelete && (
        <button className="btn-ghost danger" onClick={() => onDelete(video)}>
          Excluir
        </button>
      )}
    </div>
  )
}
