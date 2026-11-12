// Productor: manda un aviso corto a todos los socios. El administrador define cuántos puede enviar por semana.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { Icon, Msg } from './ui'

const ZONA = 'America/Argentina/Buenos_Aires'
const MAX_T = 40
const MAX_M = 120

export default function AvisosProductor() {
  const [abierto, setAbierto] = useState(false)
  const [cupo, setCupo] = useState(null)
  const [titulo, setTitulo] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [msg, setMsg] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  const cargar = useCallback(async () => {
    const { data } = await supabase.rpc('mi_cupo_avisos')
    setCupo(data || null)
  }, [])
  useEffect(() => { cargar() }, [cargar])

  async function enviar(e) {
    e.preventDefault()
    if (ocupado) return
    setOcupado(true); setMsg(null)
    const { data, error } = await supabase.rpc('enviar_aviso_productor', { p_titulo: titulo, p_mensaje: mensaje })
    setOcupado(false)
    if (error) { setMsg({ tipo: 'error', texto: error.message }); return cargar() }
    setTitulo(''); setMensaje('')
    setMsg({ tipo: 'ok', texto: 'Aviso enviado a ' + data.destinatarios + (data.destinatarios === 1 ? ' socio.' : ' socios.') })
    cargar()
  }

  const quedan = cupo ? cupo.quedan : null
  const reinicia = cupo ? new Date(cupo.reinicia).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'numeric', timeZone: ZONA }) : ''

  if (!abierto) {
    return (
      <button type="button" className="btn" style={{ width: '100%', margin: '10px 0' }} onClick={() => setAbierto(true)}>
        <Icon name="gift" size={18} />Enviar aviso a los socios{quedan !== null ? ' (te quedan ' + quedan + ')' : ''}
      </button>
    )
  }
  return (
    <div className="card">
      <h3>Aviso a los socios</h3>
      <p className="mu">Le llega a todos los socios que tengan activados los avisos. Tiene que ser corto.</p>
      {cupo && (
        <p className="mu"><b className="num">Te quedan {cupo.quedan} de {cupo.cupo}</b> esta semana. Se reinicia el {reinicia}.</p>
      )}
      <form onSubmit={enviar}>
        <label htmlFor="av-t">Título ({titulo.length}/{MAX_T})</label>
        <input id="av-t" value={titulo} maxLength={MAX_T} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej.: Happy hour hoy" />
        <label htmlFor="av-m">Mensaje ({mensaje.length}/{MAX_M})</label>
        <textarea id="av-m" rows={3} value={mensaje} maxLength={MAX_M} onChange={(e) => setMensaje(e.target.value)} placeholder="Ej.: 2x1 en pintas hasta las 22" />
        <button className="btn pri" style={{ marginTop: 10 }} disabled={ocupado || !titulo.trim() || !mensaje.trim() || (cupo && cupo.quedan <= 0)}>
          {cupo && cupo.quedan <= 0 ? 'Sin avisos hasta el ' + reinicia : 'Enviar aviso'}
        </button>
      </form>
      <Msg m={msg} />
      <div style={{ marginTop: 12 }}><button type="button" className="btn" onClick={() => { setAbierto(false); setMsg(null) }}>Cerrar</button></div>
    </div>
  )
}
