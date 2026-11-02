// Entradas a eventos: QR de identificación del socio, compra, transferencia y movimientos.
import { useCallback, useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from './supabaseClient'
import { Msg, Acordeon, fmt } from './ui'

const ZONA = 'America/Argentina/Buenos_Aires'
const PAGOS = [['efectivo', 'Efectivo en el local'], ['transferencia', 'Transferencia'], ['puntos', 'Puntos']]
const pesos = (n) => '$ ' + fmt(n)
const fechaLarga = (ts) => new Date(ts).toLocaleString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: ZONA })
const fechaCorta = (ts) => new Date(ts).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: ZONA })

// QR de identificación, arriba a la derecha del Inicio. Al tocarlo se agranda para mostrarlo en la puerta.
export function QrIdentificacion({ codigo }) {
  const [grande, setGrande] = useState(false)
  if (!codigo) return null
  const valor = 'SOC-' + codigo
  return (
    <>
      <button type="button" aria-label="Mostrar mi QR de socio" onClick={() => setGrande(true)}
        style={{ position: 'absolute', top: 14, right: 14, background: "#fff", border: 0, borderRadius: 10, padding: 6, cursor: 'pointer', lineHeight: 0 }}>
        <QRCodeSVG value={valor} size={100} />
      </button>
      {grande && (
        <div role="dialog" aria-label="Mi QR de socio" onClick={() => setGrande(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, padding: 20 }}>
          <div style={{ background: '#fff', padding: 16, borderRadius: 16 }}><QRCodeSVG value={valor} size={256} /></div>
          <p style={{ color: '#fff', textAlign: 'center' }}>Mostralo en el local para que te identifiquen.<br />Tocá para cerrar.</p>
        </div>
      )}
    </>
  )
}

function Entrada({ e, onCambio }) {
  const [verQr, setVerQr] = useState(false)
  const [pasar, setPasar] = useState(false)
  const [apodo, setApodo] = useState('')
  const [dest, setDest] = useState(null)
  const [msg, setMsg] = useState(null)

  async function buscar(ev) {
    ev.preventDefault()
    setMsg(null)
    setDest(null)
    const { data, error } = await supabase.rpc('buscar_destinatario_entrada', { p_apodo: apodo })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    if (!data || data.length === 0) return setMsg({ tipo: 'error', texto: 'No encontré a nadie con ese apodo.' })
    setDest(data[0])
  }

  async function confirmar() {
    setMsg(null)
    const { error } = await supabase.rpc('transferir_entrada', { p_entrada: e.id, p_apodo: dest.apodo })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    onCambio('Entrada pasada a ' + dest.apodo + '. Ya no la tenés.')
  }

  const pill = e.estado === 'activa' ? ['ok', 'Válida'] : e.estado === 'usada' ? ['bad', 'Usada'] : ['warn', 'Esperando el cobro']
  return (
    <div className="card">
      <div className="row">
        <b>{e.titulo}</b>
        <span className={'pill ' + pill[0]}>{pill[1]}</span>
      </div>
      <p className="mu">{fechaLarga(e.fecha)} · Entrada N.º {e.numero}</p>
      {e.estado === 'pendiente' && <p className="mu">Queda pendiente hasta que el local confirme tu pago ({e.pago === 'transferencia' ? 'transferencia' : 'efectivo'}).</p>}
      {e.estado === 'activa' && (
        <>
          <div className="row" style={{ marginTop: 8, justifyContent: 'flex-start' }}>
            <button type="button" className="btn" onClick={() => setVerQr((v) => !v)}>{verQr ? 'Ocultar QR' : 'Ver QR'}</button>
            <button type="button" className="btn" onClick={() => { setPasar((v) => !v); setDest(null); setMsg(null) }}>Pasar a otro socio</button>
          </div>
          {verQr && (
            <div style={{ background: '#fff', padding: 12, borderRadius: 12, width: 'fit-content', margin: '10px auto 0' }}>
              <QRCodeSVG value={'ENT-' + e.codigo} size={176} />
            </div>
          )}
          {pasar && !dest && (
            <form onSubmit={buscar} style={{ marginTop: 10 }}>
              <label htmlFor={'ap-' + e.id}>Apodo de quien la recibe</label>
              <input id={'ap-' + e.id} value={apodo} autoCapitalize="none" onChange={(x) => setApodo(x.target.value)} required />
              <button className="btn pri" style={{ marginTop: 10 }}>Buscar</button>
            </form>
          )}
          {pasar && dest && (
            <div className="estado warn" style={{ marginTop: 10 }}>
              <b>¿Pasarle la entrada a esta persona?</b>
              <span>Apodo: {dest.apodo}</span>
              <span>Nombre: {dest.nombre || '-'} {dest.apellido_inicial}</span>
              <span className="mu">Le llega directo y vos dejás de tenerla.</span>
              <div className="row" style={{ marginTop: 10 }}>
                <button type="button" className="btn" onClick={() => setDest(null)}>No, cambiar</button>
                <button type="button" className="btn pri" onClick={confirmar}>Sí, pasar la entrada</button>
              </div>
            </div>
          )}
        </>
      )}
      <Msg m={msg} />
    </div>
  )
}

function Comprar({ onCambio, destacado }) {
  const [lista, setLista] = useState(null)
  const [sel, setSel] = useState({}) // por evento: { pago, cantidad }
  const [msg, setMsg] = useState(null)

  const cargar = useCallback(async () => {
    const { data } = await supabase.rpc('eventos_con_entradas')
    setLista(data || [])
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const de = (id) => sel[id] || { pago: 'efectivo', cantidad: 1 }
  const poner = (id, c) => setSel((s) => ({ ...s, [id]: { ...de(id), ...c } }))

  async function comprar(ev) {
    setMsg(null)
    const { pago, cantidad } = de(ev.id)
    const { data, error } = await supabase.rpc('comprar_entrada', { p_evento: ev.id, p_pago: pago, p_cantidad: cantidad })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    cargar()
    onCambio(data.estado === 'activa'
      ? 'Listo: ya tenés ' + (cantidad === 1 ? 'tu entrada' : 'tus ' + cantidad + ' entradas') + '.'
      : 'Entrada reservada. Se activa cuando el local confirme tu pago.')
  }

  if (lista === null) return <p className="mu">Cargando...</p>
  if (lista.length === 0) return <p className="mu">Por ahora no hay entradas a la venta.</p>
  const ordenada = [...lista].sort((a, b) => (b.id === destacado) - (a.id === destacado))
  return (
    <>
      {ordenada.map((ev) => {
        const { pago, cantidad } = de(ev.id)
        const quedan = ev.cupos == null ? null : Math.max(0, ev.cupos - ev.vendidas)
        const total = pago === 'puntos' ? fmt(Number(ev.entrada_puntos) * cantidad) + ' pts' : pesos(Number(ev.entrada_pesos) * cantidad)
        return (
          <div key={ev.id} className="card" style={ev.id === destacado ? { borderColor: 'var(--am)' } : undefined}>
            <b>{ev.titulo}</b>
            <p className="mu">{fechaLarga(ev.fecha)}</p>
            {ev.descripcion && <p className="mu">{ev.descripcion}</p>}
            <p>{pesos(ev.entrada_pesos)}{ev.entrada_puntos != null && <span className="pts" style={{ fontSize: 15 }}> · {fmt(ev.entrada_puntos)} pts</span>}</p>
            {quedan !== null && <p className="mu">{quedan === 0 ? 'Entradas agotadas' : 'Quedan ' + quedan + ' entradas'}</p>}
            {quedan !== 0 && (
              <>
                <div className="chips" style={{ marginTop: 6 }}>
                  {PAGOS.map(([id, t]) => (
                    <button key={id} type="button" className={'chip' + (pago === id ? ' on' : '')} onClick={() => poner(ev.id, { pago: id })}>{t}</button>
                  ))}
                </div>
                <div className="row" style={{ marginTop: 6, justifyContent: 'flex-start', gap: 10 }}>
                  <span className="mu">Cantidad</span>
                  <button type="button" className="btn" aria-label="Menos" disabled={cantidad <= 1} onClick={() => poner(ev.id, { cantidad: cantidad - 1 })}>−</button>
                  <b>{cantidad}</b>
                  <button type="button" className="btn" aria-label="Más" disabled={cantidad >= 10 || (quedan !== null && cantidad >= quedan)} onClick={() => poner(ev.id, { cantidad: cantidad + 1 })}>+</button>
                </div>
                <button type="button" className="btn pri" style={{ marginTop: 10, width: '100%' }} onClick={() => comprar(ev)}>Comprar · {total}</button>
              </>
            )}
          </div>
        )
      })}
      <Msg m={msg} />
    </>
  )
}

function Movimientos({ version }) {
  const [filas, setFilas] = useState(null)
  useEffect(() => {
    supabase.rpc('mis_movimientos_entradas').then(({ data }) => setFilas(data || []))
  }, [version])
  if (filas === null) return <p className="mu">Cargando...</p>
  if (filas.length === 0) return <p className="mu">Todavía no hay movimientos de entradas.</p>
  const texto = (m) => {
    const otro = m.otro_apodo ? ' ' + (m.tipo === 'enviada' ? 'a ' : 'de ') + m.otro_apodo : ''
    if (m.tipo === 'enviada') return 'Enviaste la entrada N.º ' + m.numero + ' de «' + m.evento + '»' + otro
    if (m.tipo === 'recibida') return 'Recibiste la entrada N.º ' + m.numero + ' de «' + m.evento + '»' + otro
    if (m.tipo === 'comprada') return 'Compraste la entrada N.º ' + m.numero + ' de «' + m.evento + '»'
    if (m.tipo === 'usada') return 'Se usó la entrada N.º ' + m.numero + ' de «' + m.evento + '»'
    return 'Devolución de la entrada N.º ' + m.numero + ' de «' + m.evento + '»'
  }
  return filas.map((m, i) => (
    <div key={i} className="card">
      <p>{texto(m)}</p>
      <p className="mu">{fechaCorta(m.creado_en)}</p>
    </div>
  ))
}

// Sección de Canjes: mis entradas, comprar y movimientos.
export function EntradasSocio({ onSaldo, eventoCompra }) {
  const [entradas, setEntradas] = useState(null)
  const [abierta, setAbierta] = useState(eventoCompra ? 'comprar' : null)
  const [version, setVersion] = useState(0)
  const [msg, setMsg] = useState(null)

  const cargar = useCallback(async () => {
    const { data } = await supabase.rpc('mis_entradas')
    setEntradas(data || [])
  }, [])
  useEffect(() => { cargar() }, [cargar, version])
  // Si tiene entradas, la lista arranca abierta.
  useEffect(() => { if (entradas && entradas.length > 0) setAbierta((a) => a ?? 'mias') }, [entradas])

  function cambio(texto) {
    setMsg({ tipo: 'ok', texto })
    setVersion((v) => v + 1)
    if (onSaldo) onSaldo()
  }
  const alternar = (k) => setAbierta((a) => (a === k ? null : k))
  const n = entradas ? entradas.filter((e) => e.estado !== 'usada').length : 0

  return (
    <>
      <h2>Entradas</h2>
      <Msg m={msg} />
      <Acordeon titulo={'Mis entradas' + (entradas ? ' (' + n + ')' : '')} icono="barrel" abierto={abierta === 'mias'} onToggle={() => alternar('mias')}>
        {entradas && entradas.length === 0 && <p className="mu">No tenés entradas compradas.</p>}
        {(entradas || []).map((e) => <Entrada key={e.id} e={e} onCambio={cambio} />)}
      </Acordeon>
      <Acordeon titulo="Comprar entradas" icono="gift" abierto={abierta === 'comprar'} onToggle={() => alternar('comprar')}>
        <Comprar onCambio={cambio} destacado={eventoCompra} />
      </Acordeon>
      <Acordeon titulo="Movimientos de entradas" icono="crown" abierto={abierta === 'movs'} onToggle={() => alternar('movs')}>
        <Movimientos version={version} />
      </Acordeon>
    </>
  )
}

// ---- Lado del local (administrador y personal) ----

// Ficha que aparece al escanear el QR de un socio o de una entrada. Desde acá se marca la entrada como usada.
export function FichaEscaneo({ ficha, onCambio, onVolver }) {
  const [msg, setMsg] = useState(null)
  const s = ficha.socio
  async function usar(id) {
    setMsg(null)
    const { error } = await supabase.rpc('usar_entrada', { p_id: id })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: 'Entrada marcada como usada.' })
    onCambio()
  }
  return (
    <>
      <div className="estado warn" style={{ marginTop: 12 }}>
        <span>{ficha.tipo === 'entrada' ? 'Entrada de' : 'Socio'}</span>
        <b style={{ fontSize: 20 }}>{[s.nombre, s.apellido].filter(Boolean).join(' ') || 'Sin nombre'}</b>
        <span>Socio N.º {String(s.numero_socio).padStart(4, '0')}{s.apodo ? ' · ' + s.apodo : ''}</span>
      </div>
      <h3 style={{ marginTop: 12 }}>Entradas</h3>
      {(!ficha.entradas || ficha.entradas.length === 0) && <p className="mu">No tiene entradas para los próximos eventos.</p>}
      {(ficha.entradas || []).map((e) => (
        <div key={e.id} className="card" style={e.id === ficha.foco ? { outline: '2px solid var(--accent, #7dd3fc)' } : undefined}>
          <div className="row">
            <b>{e.evento}</b>
            <span className={'pill ' + (e.estado === 'activa' ? 'ok' : e.estado === 'usada' ? 'bad' : 'warn')}>
              {e.estado === 'activa' ? 'Válida' : e.estado === 'usada' ? 'Usada' : 'Sin pagar'}
            </span>
          </div>
          <p className="mu">{fechaLarga(e.fecha)} · N.º {e.numero}</p>
          {e.estado === 'usada' && <p className="mu">Usada el {fechaCorta(e.usada_en)}</p>}
          {e.estado === 'pendiente' && <p className="mu">Todavía no está paga: confirmá el cobro en Cobros.</p>}
          {e.estado === 'activa' && <button type="button" className="btn pri" style={{ marginTop: 8 }} onClick={() => usar(e.id)}>Marcar como usada</button>}
        </div>
      ))}
      <Msg m={msg} />
      <div style={{ marginTop: 10 }}><button type="button" className="btn" onClick={onVolver}>Volver</button></div>
    </>
  )
}

// Cobros: entradas pagadas en efectivo o transferencia que esperan confirmación.
export function EntradasPorCobrar() {
  const [filas, setFilas] = useState(null)
  const [msg, setMsg] = useState(null)
  const cargar = useCallback(async () => {
    const { data } = await supabase.rpc('entradas_por_cobrar')
    setFilas(data || [])
  }, [])
  useEffect(() => { cargar() }, [cargar])
  async function resolver(id, accion) {
    setMsg(null)
    const { error } = await supabase.rpc('resolver_entrada', { p_id: id, p_accion: accion })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: accion === 'confirmar' ? 'Cobro confirmado: la entrada ya está activa.' : 'Entrada cancelada.' })
    cargar()
  }
  const n = filas ? filas.length : 0
  return (
    <div className="card">
      <div className="row">
        <h3>Entradas por cobrar</h3>
        <span className={'pill ' + (n ? 'warn' : 'ok')}>{n ? n + ' pendientes' : 'Sin pendientes'}</span>
      </div>
      {n === 0 && <p className="mu">No hay entradas esperando cobro.</p>}
      {(filas || []).map((f) => (
        <div key={f.id} className="card">
          <b>{f.titulo}</b>
          <p className="mu">{fechaLarga(f.fecha)} · N.º {f.numero}</p>
          <p>{pesos(f.precio_pesos)} · {f.pago === 'transferencia' ? 'Transferencia' : 'Efectivo'}</p>
          <p className="mu">Socio N.º {String(f.socio_numero).padStart(4, '0')} · {f.socio_nombre || 'Sin nombre'} · {fechaCorta(f.creado_en)}</p>
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn" onClick={() => resolver(f.id, 'cancelar')}>Cancelar</button>
            <button type="button" className="btn pri" onClick={() => resolver(f.id, 'confirmar')}>Confirmé el cobro</button>
          </div>
        </div>
      ))}
      <Msg m={msg} />
    </div>
  )
}

// Administrador: entradas vendidas de un evento (con devolución).
export function EntradasEvento({ evento }) {
  const [filas, setFilas] = useState(null)
  const [msg, setMsg] = useState(null)
  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc('entradas_evento', { p_evento: evento })
    if (error) setMsg({ tipo: 'error', texto: error.message })
    setFilas(data || [])
  }, [evento])
  useEffect(() => { cargar() }, [cargar])
  async function devolver(f) {
    if (!window.confirm('¿Devolver la entrada N.º ' + f.numero + '?' + (f.pago === 'puntos' ? ' Se le devuelven los puntos al socio.' : ' La devolución del dinero la hacés vos.'))) return
    setMsg(null)
    const { error } = await supabase.rpc('resolver_entrada', { p_id: f.id, p_accion: 'cancelar' })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    cargar()
  }
  if (filas === null) return <p className="mu">Cargando...</p>
  return (
    <div style={{ marginTop: 8 }}>
      {filas.length === 0 && <p className="mu">Todavía no hay entradas vendidas.</p>}
      {filas.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>N.º</th><th>Socio</th><th>Pago</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id}>
                  <td>{f.numero}</td>
                  <td>{f.socio_nombre || '-'}{f.apodo ? ' (' + f.apodo + ')' : ''}</td>
                  <td>{f.pago === 'puntos' ? fmt(f.precio_puntos) + ' pts' : pesos(f.precio_pesos)}</td>
                  <td>{f.estado}</td>
                  <td>{f.estado !== 'usada' && <button type="button" className="btn" onClick={() => devolver(f)}>Devolver</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Msg m={msg} />
    </div>
  )
}
