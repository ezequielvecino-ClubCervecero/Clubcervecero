// Personal y administrador: ficha del productor escaneado y marca de presente en eventos de Cerveceros.
import { useState } from 'react'
import { supabase } from './supabaseClient'
import { Msg } from './ui'

const ZONA = 'America/Argentina/Buenos_Aires'
const fechaLarga = (ts) => new Date(ts).toLocaleString('es-AR', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: ZONA })
const hora = (ts) => new Date(ts).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: ZONA })

export function textoPresentismo(p) {
  if (!p || !p.total) return 'sin eventos todavía'
  return p.asistio + ' de ' + p.total + (p.total === 1 ? ' evento' : ' eventos') + ', ' + p.porcentaje + '%'
}

export default function FichaProductor({ ficha, onCambio, onVolver }) {
  const [msg, setMsg] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const pr = ficha.productor
  const quien = [pr.nombre, pr.apellido].filter(Boolean).join(' ')

  async function marcar(e) {
    if (ocupado) return
    setOcupado(true); setMsg(null)
    const { error } = await supabase.rpc('registrar_presente', { p_evento: e.id, p_productor: pr.id })
    setOcupado(false)
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: (pr.cerveceria || 'El productor') + ' quedó presente en "' + e.titulo + '".' })
    onCambio()
  }

  return (
    <>
      <div className="estado warn" style={{ marginTop: 12 }}>
        <span>Productor</span>
        <b style={{ fontSize: 20 }}>{pr.cerveceria || 'Sin nombre de cervecería'}</b>
        <span>Socio N.º {String(pr.numero_socio).padStart(4, '0')}</span>
        <span>Lo atiende: {quien || 'Sin nombre'}</span>
        <span>WhatsApp: {pr.whatsapp || 'sin cargar'}</span>
        <span>Presentismo: {textoPresentismo(ficha.presentismo)}</span>
      </div>
      {pr.suspendido && <p className="msg error">Esta cuenta está suspendida.</p>}
      <h3 style={{ marginTop: 12 }}>Eventos de Cerveceros</h3>
      <p className="mu">Elegí el evento al que llegó. Aparecen los de los últimos 30 días y los de hoy y mañana.</p>
      {(!ficha.eventos || ficha.eventos.length === 0) && <p className="mu">No hay eventos de Cerveceros en esas fechas.</p>}
      {(ficha.eventos || []).map((e) => (
        <div key={e.id} className="card">
          <div className="row">
            <b>{e.titulo}</b>
            {e.presente && <span className="pill ok">Presente</span>}
          </div>
          <p className="mu">{fechaLarga(e.fecha)}{e.lugar ? ' · ' + e.lugar : ''}</p>
          {e.presente
            ? <p className="mu">Registrado el {hora(e.presente_en)}.</p>
            : <button type="button" className="btn pri" style={{ marginTop: 8 }} disabled={ocupado} onClick={() => marcar(e)}>Marcar presente</button>}
        </div>
      ))}
      <Msg m={msg} />
      <div style={{ marginTop: 10 }}><button type="button" className="btn" onClick={onVolver}>Volver</button></div>
    </>
  )
}
