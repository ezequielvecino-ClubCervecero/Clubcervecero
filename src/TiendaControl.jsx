// Abrir y cerrar una tienda (la del club o la de un productor) y programar sus horarios.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { Msg } from './ui'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const ORDEN = [1, 2, 3, 4, 5, 6, 0]
const vacioDias = () => Object.fromEntries(DIAS.map((_, d) => [d, { on: false, abre: '10:00', cierra: '20:00' }]))

export const cuando = (ts) =>
  new Date(ts).toLocaleString('es-AR', { weekday: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })

export default function TiendaControl({ productorId = null, titulo = 'Mi tienda', propia = true }) {
  const [info, setInfo] = useState(null)
  const [activo, setActivo] = useState(false)
  const [dias, setDias] = useState(vacioDias())
  const [editando, setEditando] = useState(false)
  const [msg, setMsg] = useState(null)

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc('info_tienda', { p_productor: productorId })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setInfo(data)
  }, [productorId])

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 60000)
    return () => clearInterval(t)
  }, [cargar])

  // Se cargan los horarios guardados salvo que se esté editando (así el refresco no pisa lo escrito).
  useEffect(() => {
    if (!info || editando) return
    setActivo(info.horario_activo)
    const m = vacioDias()
    info.horarios.forEach((h) => { m[h.dia] = { on: true, abre: h.abre, cierra: h.cierra } })
    setDias(m)
  }, [info, editando])

  async function cambiar(abrir) {
    setMsg(null)
    const { error } = await supabase.rpc('cambiar_tienda', { p_productor: productorId, p_abrir: abrir })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: abrir ? 'Tienda abierta.' : 'Tienda cerrada.' })
    cargar()
  }

  async function guardar() {
    setMsg(null)
    const lista = []
    for (const d of ORDEN) {
      const x = dias[d]
      if (!x.on) continue
      if (!x.abre || !x.cierra || x.cierra <= x.abre) {
        return setMsg({ tipo: 'error', texto: DIAS[d] + ': la hora de cierre tiene que ser después de la de apertura.' })
      }
      lista.push({ dia: d, abre: x.abre, cierra: x.cierra })
    }
    const { error } = await supabase.rpc('guardar_horarios', { p_productor: productorId, p_activo: activo, p_horarios: lista })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: activo ? 'Horarios guardados: la tienda abre y cierra sola.' : 'Horarios guardados, pero están desactivados.' })
    setEditando(false)
    cargar()
  }

  const poner = (d, campo, valor) => setDias((m) => ({ ...m, [d]: { ...m[d], [campo]: valor } }))

  if (!info) return <><Msg m={msg} /></>

  return (
    <div className="card" style={info.abierta ? undefined : { borderColor: 'var(--am)' }}>
      <div className="row">
        <h3>{titulo}</h3>
        <span className={'pill ' + (info.abierta ? 'ok' : 'bad')}>{info.abierta ? 'Abierta' : 'Cerrada'}</span>
      </div>
      {info.bloqueada && (
        <p className="msg error">
          {propia
            ? 'Se cerró sola porque no respondiste 3 pedidos seguidos. Abrila cuando puedas atender.'
            : 'Se cerró sola por 3 pedidos seguidos sin respuesta. La podés abrir desde acá.'}
        </p>
      )}
      {!info.abierta && info.proxima_apertura && !info.bloqueada && (
        <p className="mu">Según el horario, abre el {cuando(info.proxima_apertura)}.</p>
      )}
      <p className="mu">
        {info.horario_activo ? 'Usa horarios automáticos.' : 'Sin horarios automáticos: abre y cierra solo a mano.'}
        {' '}Lo que hagas a mano vale hasta el próximo cambio del horario.
      </p>
      <div className="row" style={{ marginTop: 10 }}>
        <button type="button" className="btn pri" onClick={() => cambiar(!info.abierta)}>{info.abierta ? 'Cerrar tienda' : 'Abrir tienda'}</button>
        <button type="button" className="btn" onClick={() => setEditando((e) => !e)}>{editando ? 'Cerrar horarios' : 'Horarios'}</button>
      </div>
      {editando && (
        <div style={{ marginTop: 12 }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            Usar horarios automáticos
          </label>
          {ORDEN.map((d) => (
            <div key={d} className="row" style={{ marginTop: 8, flexWrap: 'wrap', justifyContent: 'flex-start', gap: 8 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 120 }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={dias[d].on} onChange={(e) => poner(d, 'on', e.target.checked)} />
                {DIAS[d]}
              </label>
              <input type="time" aria-label={DIAS[d] + ' abre'} style={{ width: 'auto' }} disabled={!dias[d].on} value={dias[d].abre} onChange={(e) => poner(d, 'abre', e.target.value)} />
              <span className="mu">a</span>
              <input type="time" aria-label={DIAS[d] + ' cierra'} style={{ width: 'auto' }} disabled={!dias[d].on} value={dias[d].cierra} onChange={(e) => poner(d, 'cierra', e.target.value)} />
            </div>
          ))}
          <p className="mu" style={{ marginTop: 8 }}>Los días sin tildar quedan cerrados. Al guardar, cualquier orden manual anterior se borra.</p>
          <button type="button" className="btn pri" style={{ marginTop: 10 }} onClick={guardar}>Guardar horarios</button>
        </div>
      )}
      <Msg m={msg} />
    </div>
  )
}
