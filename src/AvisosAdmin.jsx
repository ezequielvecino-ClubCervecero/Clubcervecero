// Administrador: envía avisos al club, define el cupo semanal de cada productor y ve el historial.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { Msg } from './ui'

const ZONA = 'America/Argentina/Buenos_Aires'
const fecha = (ts) => new Date(ts).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: ZONA })

export default function AvisosAdmin() {
  const [datos, setDatos] = useState(null)
  const [hist, setHist] = useState(null)
  const [msg, setMsg] = useState(null)
  const [general, setGeneral] = useState('')
  const [edit, setEdit] = useState({})
  const [titulo, setTitulo] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [dest, setDest] = useState('todos')
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(async () => {
    const [c, h] = await Promise.all([supabase.rpc('cupos_avisos_admin'), supabase.rpc('historial_avisos_productor', { p_limite: 100 })])
    if (c.error) setMsg({ tipo: 'error', texto: c.error.message })
    setDatos(c.data || null)
    setHist(h.data || [])
    if (c.data) setGeneral(String(c.data.defecto))
  }, [])
  useEffect(() => { cargar() }, [cargar])

  async function enviar(e) {
    e.preventDefault()
    if (enviando) return
    setMsg(null)
    setEnviando(true)
    const { data, error } = await supabase.rpc('enviar_aviso_admin', { p_titulo: titulo, p_mensaje: mensaje, p_destinatario: dest })
    setEnviando(false)
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: 'Aviso enviado a ' + data.destinatarios + (data.destinatarios === 1 ? ' persona.' : ' personas.') + ' Quienes apagaron estos avisos no lo reciben.' })
    setTitulo('')
    setMensaje('')
    cargar()
  }

  async function guardarGeneral(aTodos) {
    setMsg(null)
    const { error } = await supabase.rpc('poner_cupo_general', { p_cupo: Number(general), p_a_todos: aTodos })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: aTodos ? 'Listo: todos los productores tienen ' + general + ' por semana.' : 'Cupo general guardado.' })
    setEdit({})
    cargar()
  }

  async function guardarUno(p, valor) {
    setMsg(null)
    const { error } = await supabase.rpc('poner_cupo_aviso', { p_productor: p.id, p_cupo: valor === '' || valor === null ? null : Number(valor) })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setEdit((e) => { const n = { ...e }; delete n[p.id]; return n })
    cargar()
  }

  return (
    <>
      <h2>Avisos de productores</h2>
      <p className="mu">Los productores mandan avisos cortos a todos los socios. Acá elegís cuántos pueden enviar por semana (la semana va de lunes a domingo).</p>
      <Msg m={msg} />
      {!datos ? <p className="mu">Cargando...</p> : (
        <>
          <form className="card" onSubmit={enviar}>
            <h3>Enviar un aviso del club</h3>
            <label htmlFor="av-dest">Para quién</label>
            <select id="av-dest" value={dest} onChange={(e) => setDest(e.target.value)}>
              <option value="todos">Todos (socios y productores)</option>
              <option value="productores">Solo productores</option>
              <option value="socios">Solo socios</option>
            </select>
            <label htmlFor="av-tit">Título ({titulo.length}/40)</label>
            <input id="av-tit" maxLength={40} value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
            <label htmlFor="av-msj">Mensaje ({mensaje.length}/120)</label>
            <textarea id="av-msj" rows={3} maxLength={120} value={mensaje} onChange={(e) => setMensaje(e.target.value)} required />
            <button type="submit" className="btn pri" style={{ marginTop: 10 }} disabled={enviando || !titulo.trim() || !mensaje.trim()}>{enviando ? 'Enviando...' : 'Enviar aviso'}</button>
            <p className="mu" style={{ fontSize: 13 }}>Llega como notificación push, sin cupo semanal. Quien apagó los avisos del club en sus preferencias no lo recibe. Queda en el historial.</p>
          </form>

          <div className="card">
            <h3>Cupo general</h3>
            <label htmlFor="av-gen">Avisos por semana por productor</label>
            <input id="av-gen" type="number" min="0" max="50" step="1" value={general} onChange={(e) => setGeneral(e.target.value)} />
            <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn pri" onClick={() => guardarGeneral(false)}>Guardar general</button>
              <button type="button" className="btn" onClick={() => guardarGeneral(true)}>Aplicar a todos</button>
            </div>
            <p className="mu" style={{ fontSize: 13 }}>"Aplicar a todos" borra los cupos propios y todos pasan a usar este número. Con 0 se bloquean los avisos.</p>
          </div>

          <div className="card">
            <h3>Cupo de cada productor</h3>
            {datos.productores.length === 0 && <p className="mu">Todavía no hay productores.</p>}
            {datos.productores.map((p) => {
              const v = edit[p.id] !== undefined ? edit[p.id] : (p.propio === null ? '' : String(p.propio))
              return (
                <div key={p.id} style={{ padding: '10px 0', borderTop: '1px solid var(--ln)' }}>
                  <b>{p.cerveceria}</b>
                  <p className="mu" style={{ margin: '2px 0' }}>Usó {p.usados} de {p.cupo} esta semana{p.propio === null ? ' (cupo general)' : ' (cupo propio)'}</p>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <input aria-label={'Cupo de ' + p.cerveceria} type="number" min="0" max="50" step="1" style={{ width: 90 }} placeholder="General"
                      value={v} onChange={(e) => setEdit({ ...edit, [p.id]: e.target.value })} />
                    <button type="button" className="btn" onClick={() => guardarUno(p, v)}>Guardar</button>
                    {p.propio !== null && <button type="button" className="btn" onClick={() => guardarUno(p, null)}>Usar general</button>}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="card">
            <h3>Historial</h3>
            {hist && hist.length === 0 && <p className="mu">Todavía no se envió ningún aviso.</p>}
            {(hist || []).map((a) => (
              <div key={a.id} style={{ padding: '10px 0', borderTop: '1px solid var(--ln)' }}>
                <p className="mu" style={{ margin: 0 }}>{fecha(a.creado_en)} · <b>{a.cerveceria}</b> · {a.del_admin ? 'para ' + ({ todos: 'todos', productores: 'productores', socios: 'socios' }[a.destinatario] || a.destinatario) + ' · ' : 'para socios · '}{a.destinatarios} {a.destinatarios === 1 ? 'persona' : 'personas'}</p>
                <p style={{ margin: '2px 0' }}><b>{a.titulo}</b></p>
                <p className="mu" style={{ margin: 0 }}>{a.mensaje}</p>
              </div>
            ))}
            <p className="mu" style={{ fontSize: 12 }}>Se muestran los últimos 100.</p>
          </div>
        </>
      )}
    </>
  )
}
