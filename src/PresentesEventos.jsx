// Administrador y personal: eventos de Cerveceros con su lista de productores presentes.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { Msg } from './ui'

const ZONA = 'America/Argentina/Buenos_Aires'
const fecha = (ts) => new Date(ts).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: ZONA })

export default function PresentesEventos({ esAdmin }) {
  const [eventos, setEventos] = useState(null)
  const [abierto, setAbierto] = useState(null)
  const [lista, setLista] = useState([])
  const [msg, setMsg] = useState(null)

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc('eventos_cerveceros_presentes')
    if (error) setMsg({ tipo: 'error', texto: error.message })
    setEventos(data || [])
  }, [])
  useEffect(() => { cargar() }, [cargar])

  async function ver(e) {
    if (abierto === e.id) return setAbierto(null)
    setMsg(null)
    const { data, error } = await supabase.rpc('presentes_evento', { p_evento: e.id })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setLista(data || [])
    setAbierto(e.id)
  }

  async function quitar(e, p) {
    if (!window.confirm('¿Sacar a ' + p.cerveceria + ' de la lista de presentes?')) return
    const { error } = await supabase.rpc('quitar_presente', { p_evento: e.id, p_productor: p.productor_id })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setAbierto(null)
    cargar()
  }

  return (
    <div className="card">
      <h3>Presentismo en Eventos de Cerveceros</h3>
      <p className="mu">Quiénes llegaron a cada evento. Se marca escaneando el QR del productor.</p>
      <Msg m={msg} />
      {eventos === null && <p className="mu">Cargando...</p>}
      {eventos && eventos.length === 0 && <p className="mu">Todavía no hay eventos de Cerveceros.</p>}
      {(eventos || []).map((e) => (
        <div key={e.id} style={{ padding: '8px 0', borderTop: '1px solid var(--ln)' }}>
          <div className="row">
            <span><b>{e.titulo}</b> <span className="mu">· {fecha(e.fecha)}</span></span>
            <button type="button" className="btn" onClick={() => ver(e)}>{abierto === e.id ? 'Ocultar' : 'Presentes (' + e.presentes + ')'}</button>
          </div>
          {abierto === e.id && (
            <div style={{ marginTop: 6 }}>
              {lista.length === 0 && <p className="mu">Nadie marcado todavía.</p>}
              {lista.map((p) => (
                <div key={p.productor_id} className="row" style={{ padding: '4px 0' }}>
                  <span>{p.cerveceria} <span className="mu">· N.º {String(p.numero_socio).padStart(4, '0')} · {fecha(p.registrado_en)} · lo registró {p.registrado_por}</span></span>
                  {esAdmin && <button type="button" className="btn" onClick={() => quitar(e, p)}>Quitar</button>}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
