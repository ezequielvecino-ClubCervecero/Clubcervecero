// Administrador: crea QR de puntos (cuántos puntos da y cuántas veces se puede escanear en total).
import { useCallback, useEffect, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from './supabaseClient'
import { Msg, Acordeon, fmt } from './ui'

const ZONA = 'America/Argentina/Buenos_Aires'
const fecha = (ts) => new Date(ts).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: ZONA })
const estadoDe = (q) => {
  if (!q.activo) return ['bad', 'Apagado']
  if (q.vence_en && new Date(q.vence_en).getTime() <= Date.now()) return ['bad', 'Vencido']
  if (q.usos >= q.usos_total) return ['warn', 'Agotado']
  return ['ok', 'Activo']
}
const valorQr = (q) => 'PTS-' + q.codigo

function imprimir(q) {
  const svg = renderToStaticMarkup(<QRCodeSVG value={valorQr(q)} size={320} />)
  const w = window.open('', '_blank')
  if (!w) return
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  w.document.write('<!doctype html><title>QR de puntos</title><body style="font-family:sans-serif;text-align:center;padding:30px">' +
    '<h1>' + esc(q.nombre) + '</h1><h2>Escaneá y ganá ' + esc(fmt(q.puntos)) + ' puntos</h2>' + svg +
    '<p>' + (q.solo_gold ? 'Solo socios Gold. ' : '') + 'Se puede usar ' + esc(q.usos_total) + (q.usos_total === 1 ? ' vez en total: gana el primero que llega.' : ' veces en total.') + '</p></body>')
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 300)
}

export default function QrPuntosAdmin() {
  const [lista, setLista] = useState(null)
  const [msg, setMsg] = useState(null)
  const [f, setF] = useState({ nombre: '', puntos: '', usos: '1', gold: 'todos', vence: '' })
  const [grande, setGrande] = useState(null)
  const [verUsos, setVerUsos] = useState(null)

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc('lista_qr_puntos')
    if (error) setMsg({ tipo: 'error', texto: error.message })
    setLista(data || [])
  }, [])
  useEffect(() => { cargar() }, [cargar])

  async function crear(e) {
    e.preventDefault()
    setMsg(null)
    const { data, error } = await supabase.rpc('crear_qr_puntos', {
      p_nombre: f.nombre, p_puntos: Number(f.puntos), p_usos: Number(f.usos),
      p_solo_gold: f.gold === 'gold', p_vence: f.vence ? new Date(f.vence).toISOString() : null,
    })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: 'QR creado. Mostralo en pantalla o imprimilo.' })
    setF({ nombre: '', puntos: '', usos: '1', gold: 'todos', vence: '' })
    await cargar()
    setGrande(data)
  }

  async function apagar(q, activo) {
    setMsg(null)
    const { error } = await supabase.rpc('apagar_qr_puntos', { p_id: q.id, p_activo: activo })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    cargar()
  }

  return (
    <>
      <form className="card" onSubmit={crear}>
        <h3>Crear QR de puntos</h3>
        <p className="mu">El socio lo escanea desde su app y suma los puntos. Cada socio lo puede usar una sola vez; la cantidad de escaneos es el total entre todos.</p>
        <label htmlFor="qp-n">Nombre o motivo (ej. Fiesta de la birra)</label>
        <input id="qp-n" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} required />
        <label htmlFor="qp-p">Puntos que da</label>
        <input id="qp-p" type="number" min="0.01" step="0.01" inputMode="decimal" value={f.puntos} onChange={(e) => setF({ ...f, puntos: e.target.value })} required />
        <label htmlFor="qp-u">Cantidad de escaneos en total (1 = gana el primero que llega)</label>
        <input id="qp-u" type="number" min="1" max="10000" step="1" inputMode="numeric" value={f.usos} onChange={(e) => setF({ ...f, usos: e.target.value })} required />
        <label htmlFor="qp-g">¿Quién puede usarlo?</label>
        <select id="qp-g" value={f.gold} onChange={(e) => setF({ ...f, gold: e.target.value })}>
          <option value="todos">Todos los socios</option>
          <option value="gold">Solo socios Gold (cuota al día)</option>
        </select>
        <label htmlFor="qp-v">Vencimiento (opcional)</label>
        <input id="qp-v" type="datetime-local" value={f.vence} onChange={(e) => setF({ ...f, vence: e.target.value })} />
        <button className="btn pri" style={{ marginTop: 14 }}>Crear QR</button>
      </form>
      <Msg m={msg} />

      <h2>Mis QR de puntos</h2>
      {lista === null && <p className="mu">Cargando...</p>}
      {lista && lista.length === 0 && <p className="mu">Todavía no creaste ninguno.</p>}
      {(lista || []).map((q) => {
        const [clase, txt] = estadoDe(q)
        return (
          <div key={q.id} className="card">
            <div className="row"><b>{q.nombre}</b><span className={'pill ' + clase}>{txt}</span></div>
            <p>{fmt(q.puntos)} puntos · usos {q.usos} de {q.usos_total} · {q.solo_gold ? 'Solo Gold' : 'Todos los socios'}</p>
            <p className="mu">Creado el {fecha(q.creado_en)}{q.vence_en ? ' · vence el ' + fecha(q.vence_en) : ' · sin vencimiento'}</p>
            <div className="row" style={{ marginTop: 8 }}>
              <button type="button" className="btn pri" onClick={() => setGrande(q)}>Mostrar en pantalla</button>
              <button type="button" className="btn" onClick={() => imprimir(q)}>Imprimir</button>
              <button type="button" className="btn" onClick={() => apagar(q, !q.activo)}>{q.activo ? 'Apagar' : 'Volver a activar'}</button>
            </div>
            <div style={{ marginTop: 8 }}>
              <Acordeon titulo={'Quién lo usó (' + q.usuarios.length + ')'} icono="crown" abierto={verUsos === q.id} onToggle={() => setVerUsos(verUsos === q.id ? null : q.id)}>
                {q.usuarios.length === 0 && <p className="mu">Nadie lo usó todavía.</p>}
                {q.usuarios.map((u, i) => <p key={i} className="mu">N.º {String(u.numero_socio).padStart(4, '0')} · {u.nombre || 'Sin nombre'} · {fecha(u.usado_en)}</p>)}
              </Acordeon>
            </div>
          </div>
        )
      })}

      {grande && (
        <div role="dialog" aria-label="QR de puntos" onClick={() => setGrande(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, padding: 20 }}>
          <h2 style={{ color: '#fff', textAlign: 'center' }}>{grande.nombre}</h2>
          <div style={{ background: '#fff', padding: 18, borderRadius: 16 }}><QRCodeSVG value={valorQr(grande)} size={Math.min(320, window.innerWidth - 90)} /></div>
          <p style={{ color: '#fff', textAlign: 'center', fontSize: 20 }}>Escaneá y ganá {fmt(grande.puntos)} puntos</p>
          <p style={{ color: '#fff', textAlign: 'center' }}>Tocá para cerrar.</p>
        </div>
      )}
    </>
  )
}
