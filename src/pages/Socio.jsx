import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { QRCodeSVG } from 'qrcode.react'
import { Icon, Coin, Msg, Acordeon, Navegacion, Categoria, CATS, fmt, fechaHora, TIPOS } from '../ui'
import Tienda from './Tienda'
import Puesto from '../Puesto'

const COSTO_TRANSFERENCIA = 0.5
const MES = new Date().toLocaleDateString('es-AR', { month: 'long' })

const ICONOS = { Recargas: 'recarga', 'Cervezas especiales': 'pint', Merchandise: 'crown', 'Entradas a eventos': 'barrel' }

// Estado de la cuota: verde al dia, ambar vencida, rojo con descuento aplicado.
function estadoCuota(p) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const hasta = new Date(p.cuota_pagada_hasta + 'T00:00:00')
  const fecha = hasta.toLocaleDateString('es-AR')
  if (p.meses_impagos_aplicados >= 2)
    return { clase: 'bad', titulo: 'Cuota impaga: se descontó el 100%', texto: 'Se descontaron todos tus puntos por dos meses sin pagar. Pagá tu cuota para volver a sumar.' }
  if (p.meses_impagos_aplicados === 1)
    return { clase: 'bad', titulo: 'Cuota impaga: se descontó el 50%', texto: 'Si pasa otro mes sin pagar, se descuentan todos tus puntos.' }
  if (hoy > hasta)
    return { clase: 'warn', titulo: 'Cuota vencida', texto: 'Venció el ' + fecha + '. Pagala antes de que pase un mes para no perder puntos.' }
  return { clase: 'ok', titulo: 'Cuota al día', texto: 'Paga hasta el ' + fecha + '.' }
}

function Inicio({ perfil }) {
  const [p, setP] = useState(perfil)
  const [saldo, setSaldo] = useState(0)

  const cargar = useCallback(async () => {
    const [s, pf] = await Promise.all([
      supabase.rpc('saldo_disponible', { p_socio: perfil.id }),
      supabase.from('perfiles').select('*').eq('id', perfil.id).single(),
    ])
    setSaldo(s.data ?? 0)
    if (pf.data) setP(pf.data)
  }, [perfil.id])

  useEffect(() => { cargar() }, [cargar])

  const e = estadoCuota(p)

  return (
    <>
      <div className="member">
        <h2 style={{ margin: 0 }}>{[p.nombre, p.apellido].filter(Boolean).join(' ') || 'Socio'}</h2>
        <p style={{ margin: '4px 0' }}><Categoria valor={p.categoria} /></p>
        <p className="mu">Socio N.º {String(p.numero_socio).padStart(4, '0')}</p>
        {p.apodo && <p className="mu">Apodo: {p.apodo}</p>}
        <p className="mu" style={{ marginTop: 14 }}>Saldo disponible</p>
        <div className="bal num"><Coin />{fmt(saldo)}</div>
        <p className="mu">puntos</p>
      </div>

      <div className={'estado ' + e.clase}>
        <b>{e.titulo}</b>
        <span>{e.texto}</span>
      </div>

      <PedidosEnCamino perfil={perfil} />
      <ProximoEvento />
      <Novedades />
    </>
  )
}

function Transferir({ onListo, alDia }) {
  const [destino, setDestino] = useState('')
  const [puntos, setPuntos] = useState('')
  const [msg, setMsg] = useState(null)

  async function enviar(e) {
    e.preventDefault()
    setMsg(null)
    const { data, error } = await supabase.rpc('transferir_puntos', {
      p_destino: destino.trim(), p_puntos: Number(puntos),
    })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: 'Enviaste ' + fmt(puntos) + ' puntos a ' + destino.trim() + '. Costo de la transferencia: ' + fmt(COSTO_TRANSFERENCIA) + ' puntos. Tu saldo disponible ahora es ' + fmt(data) + '.' })
    setDestino('')
    setPuntos('')
    onListo()
  }

  return (
    <form className="card" onSubmit={enviar}>
      <p className="mu">Se usa solo el saldo disponible. Cada transferencia cuesta {fmt(COSTO_TRANSFERENCIA)} puntos, que se suman a lo que enviás. Tenés que tener la cuota al día.</p>
      {!alDia && <p className="msg error">Tu cuota no está al día: pagala para poder pasar puntos.</p>}
      <label htmlFor="t-dest">Número de socio o apodo</label>
      <input id="t-dest" value={destino} onChange={(e) => setDestino(e.target.value)} required />
      <label htmlFor="t-pts">Puntos a pasar</label>
      <input id="t-pts" type="number" min="0.25" step="0.25" value={puntos} onChange={(e) => setPuntos(e.target.value)} required />
      {puntos > 0 && <p className="mu">Se descontarán {fmt(Number(puntos) + COSTO_TRANSFERENCIA)} puntos de tu saldo.</p>}
      <button className="btn pri" style={{ marginTop: 16 }} disabled={!alDia}><Icon name="gift" size={18} />Pasar puntos</button>
      <Msg m={msg} />
    </form>
  )
}

function Ranking({ p }) {
  const [filas, setFilas] = useState(null)
  useEffect(() => { supabase.rpc('ranking_mensual').then(({ data }) => setFilas(data || [])) }, [])
  const mes = new Date().toLocaleDateString('es-AR', { month: 'long' })

  return (
    <>
      <p className="mu">Puntos usados en canjes y compras con puntos en {mes}. Se reinicia solo cada mes. Las flechas comparan con el mes anterior. Solo aparecen los socios que eligieron un apodo.</p>
      {!p.apodo && <p className="msg error">Elegí tu apodo en Perfil, Mi apodo, para aparecer en el ranking.</p>}
      {filas && filas.length === 0 && <p className="mu">Todavía nadie usó puntos este mes.</p>}
      {(filas || []).map((f) => (
        <div key={f.posicion} className={'card row' + (f.es_mio ? ' mio' : '')}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><Puesto pos={f.posicion} anterior={f.pos_anterior} /> {f.apodo}{f.es_mio ? ' (vos)' : ''}</span>
          <span className="pts plus">{fmt(f.puntos)}</span>
        </div>
      ))}
    </>
  )
}

function Apodo({ p, onListo }) {
  const [apodo, setApodo] = useState(p.apodo || '')
  const [msg, setMsg] = useState(null)

  async function guardar(e) {
    e.preventDefault()
    setMsg(null)
    const { error } = await supabase.rpc('cambiar_apodo', { p_apodo: apodo })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: apodo.trim() ? 'Apodo guardado: ' + apodo.trim() : 'Apodo borrado. Ya no aparecés en el ranking.' })
    onListo()
  }

  return (
    <form className="card" onSubmit={guardar}>
      <p className="mu">Con tu apodo aparecés en el ranking mensual y otros socios pueden pasarte puntos. De 3 a 20 caracteres: letras, números, punto o guion bajo.</p>
      <label htmlFor="apodo">Apodo</label>
      <input id="apodo" value={apodo} maxLength={20} onChange={(e) => setApodo(e.target.value)} />
      <button className="btn pri" style={{ marginTop: 16 }}>Guardar apodo</button>
      <Msg m={msg} />
    </form>
  )
}

function InformarPago() {
  const [ultimo, setUltimo] = useState(null)
  const [msg, setMsg] = useState(null)

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('pagos_informados').select('*').order('creado_en', { ascending: false }).limit(1)
    setUltimo(data && data[0] ? data[0] : null)
  }, [])
  useEffect(() => { cargar() }, [cargar])

  async function informar() {
    setMsg(null)
    const { error } = await supabase.rpc('informar_pago')
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: 'Listo, avisamos que pagaste. Tu cuota se actualiza cuando el local confirme el pago.' })
    cargar()
  }

  const pendiente = ultimo && ultimo.estado === 'pendiente'
  return (
    <div style={{ marginBottom: 12 }}>
      {pendiente
        ? <p className="mu">Pago informado el {fechaHora(ultimo.creado_en)}: pendiente de confirmación.</p>
        : <button className="btn" onClick={informar}><Icon name="crown" size={18} />Informar pago</button>}
      {!pendiente && ultimo && ultimo.estado === 'rechazado' && (
        <p className="msg error">El local no pudo confirmar tu último aviso de pago. Hablá con el personal.</p>
      )}
      <Msg m={msg} />
    </div>
  )
}

function Perfil({ perfil }) {
  const [p, setP] = useState(perfil)
  const [movs, setMovs] = useState([])
  const [abierta, setAbierta] = useState(null)

  const cargar = useCallback(async () => {
    const [m, pf] = await Promise.all([
      supabase.from('movimientos_puntos').select('*').order('creado_en', { ascending: false }).limit(10),
      supabase.from('perfiles').select('*').eq('id', perfil.id).single(),
    ])
    setMovs(m.data || [])
    if (pf.data) setP(pf.data)
  }, [perfil.id])
  useEffect(() => { cargar() }, [cargar])

  const alternar = (k) => setAbierta((a) => (a === k ? null : k))

  return (
    <>
      <div className="card">
        <h2 style={{ margin: 0 }}>{[p.nombre, p.apellido].filter(Boolean).join(' ') || 'Socio'}</h2>
        <p style={{ margin: '4px 0' }}><Categoria valor={p.categoria} /></p>
        <p className="mu">Socio N.º {String(p.numero_socio).padStart(4, '0')}</p>
        {p.apodo && <p className="mu">Apodo: {p.apodo}</p>}
        <p className="mu" style={{ marginTop: 8 }}>Invitá a un amigo: si al crear su cuenta escribe tu número de socio{p.apodo ? ' o tu apodo' : ''}, sumás 0,25 puntos.</p>
      </div>

      <Acordeon titulo="Informar pago" icono="crown" abierto={abierta === 'pago'} onToggle={() => alternar('pago')}>
        <InformarPago />
      </Acordeon>

      <Acordeon titulo="Mis datos" icono="crown" abierto={abierta === 'datos'} onToggle={() => alternar('datos')}>
        <MisDatos p={p} onListo={cargar} />
      </Acordeon>

      <Acordeon titulo="Mi apodo" icono="hop" abierto={abierta === 'apodo'} onToggle={() => alternar('apodo')}>
        <Apodo p={p} onListo={cargar} />
      </Acordeon>

      <Acordeon titulo="Últimos movimientos" icono="barrel" abierto={abierta === 'movs'} onToggle={() => alternar('movs')}>
        {movs.length === 0 && <p className="mu">Todavía no tenés movimientos.</p>}
        {movs.map((m) => (
          <div key={m.id} className="card row">
            <div>
              <b>{TIPOS[m.tipo]}</b>
              <p className="mu">{m.descripcion} · {fechaHora(m.creado_en)}</p>
            </div>
            <span className={'pts ' + (m.puntos > 0 ? 'plus' : 'minus')}>{m.puntos > 0 ? '+' : ''}{fmt(m.puntos)}</span>
          </div>
        ))}
      </Acordeon>
    </>
  )
}

function Canjes({ perfil }) {
  const [saldo, setSaldo] = useState(0)
  const [recs, setRecs] = useState([])
  const [cat, setCat] = useState(CATS[0])
  const [cupon, setCupon] = useState(null)
  const [msg, setMsg] = useState(null)

  const cargar = useCallback(async () => {
    const [s, r] = await Promise.all([
      supabase.rpc('saldo_disponible', { p_socio: perfil.id }),
      supabase.from('recompensas').select('*').order('puntos_costo'),
    ])
    setSaldo(s.data ?? 0)
    setRecs(r.data || [])
  }, [perfil.id])

  useEffect(() => { cargar() }, [cargar])

  async function generar(id) {
    setMsg(null)
    const { data, error } = await supabase.rpc('generar_cupon', { p_recompensa: id })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setCupon(data)
    cargar()
  }

  async function cancelar() {
    await supabase.rpc('cancelar_cupon', { p_cupon: cupon.id })
    setCupon(null)
    cargar()
  }

  return (
    <>
      <h2>Canjes</h2>
      <p className="mu">Saldo disponible: <b className="num">{fmt(saldo)}</b> puntos</p>

      {cupon && (
        <div className="card" style={{ borderColor: 'var(--am)' }}>
          <h3>Tu cupón de canje</h3>
          <div className="codigo">{cupon.codigo}</div>
          <div style={{ background: '#fff', padding: 12, borderRadius: 12, width: 'fit-content', margin: '0 auto 10px' }}>
            <QRCodeSVG value={cupon.codigo} size={176} />
          </div>
          <p className="mu" style={{ textAlign: 'center' }}>
            Mostralo en caja antes de las {new Date(cupon.vence_en).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}. Se usa una sola vez.
          </p>
          <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
            <button className="btn" onClick={cancelar}>Cancelar cupón</button>
            <button className="btn" onClick={() => setCupon(null)}>Cerrar</button>
          </div>
        </div>
      )}

      <div className="chips">
        {CATS.map((c) => (
          <button key={c} className={'chip' + (c === cat ? ' on' : '')} onClick={() => setCat(c)}>
            <Icon name={ICONOS[c]} size={16} />{c}
          </button>
        ))}
      </div>
      {recs.filter((r) => r.categoria === cat).map((r) => (
        <div key={r.id} className="card row">
          <div>
            <b>{r.nombre}</b>
            <p className="pts">{fmt(r.puntos_costo)} pts</p>
          </div>
          <button className="btn pri" disabled={saldo < r.puntos_costo} onClick={() => generar(r.id)}>
            <Icon name="gift" size={18} />
            {saldo < r.puntos_costo ? 'Faltan ' + fmt(r.puntos_costo - saldo) : 'Generar cupón'}
          </button>
        </div>
      ))}
      <Msg m={msg} />
    </>
  )
}

function Club({ perfil }) {
  const [p, setP] = useState(perfil)
  const [abierta, setAbierta] = useState(null)

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('perfiles').select('*').eq('id', perfil.id).single()
    if (data) setP(data)
  }, [perfil.id])

  useEffect(() => { cargar() }, [cargar])

  const e = estadoCuota(p)
  const alternar = (k) => setAbierta((a) => (a === k ? null : k))

  return (
    <>
      <h2>Club</h2>
      <Acordeon titulo="Pasar puntos" icono="recarga" abierto={abierta === 'pasar'} onToggle={() => alternar('pasar')}>
        <Transferir onListo={cargar} alDia={e.clase === 'ok'} />
      </Acordeon>

      <Acordeon titulo={'Ranking de ' + MES} icono="crown" abierto={abierta === 'ranking'} onToggle={() => alternar('ranking')}>
        <Ranking p={p} />
      </Acordeon>
    </>
  )
}

export default function Socio({ perfil }) {
  const [vista, setVista] = useState('inicio')
  return (
    <>
      {vista === 'inicio' && <Inicio perfil={perfil} />}
      {vista === 'tienda' && <Tienda perfil={perfil} />}
      {vista === 'canjes' && <Canjes perfil={perfil} />}
      {vista === 'club' && <Club perfil={perfil} />}
      {vista === 'perfil' && <Perfil perfil={perfil} />}
      <Navegacion
        items={[['inicio', 'Inicio', 'crown'], ['tienda', 'Tienda', 'pint'], ['canjes', 'Canjes', 'gift'], ['club', 'Club', 'barrel'], ['perfil', 'Perfil', 'hop']]}
        actual={vista} onElegir={setVista} />
    </>
  )
}

const ZONA = 'America/Argentina/Buenos_Aires'

function ProximoEvento() {
  const [ev, setEv] = useState(undefined)
  const [msg, setMsg] = useState(null)

  const cargar = useCallback(async () => {
    const { data } = await supabase.rpc('proximo_evento')
    setEv(data && data[0] ? data[0] : null)
  }, [])
  useEffect(() => { cargar() }, [cargar])

  async function alternar() {
    setMsg(null)
    const { error } = await supabase.rpc('anotarse_evento', { p_evento: ev.id, p_anotar: !ev.anotado })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    cargar()
  }

  if (ev === undefined) return null
  if (ev === null) {
    return (
      <>
        <h2>Próximo evento</h2>
        <p className="mu">Todavía no hay un próximo evento.</p>
      </>
    )
  }

  const f = new Date(ev.fecha)
  const dia = f.toLocaleDateString('es-AR', { day: 'numeric', timeZone: ZONA })
  const mes = f.toLocaleDateString('es-AR', { month: 'short', timeZone: ZONA }).replace('.', '')
  const hora = f.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: ZONA })
  const quedan = ev.cupos == null ? null : Math.max(0, ev.cupos - Number(ev.inscriptos))
  const cupos = quedan === null ? '' : quedan === 0 ? 'Cupos agotados' : quedan <= 5 ? 'Quedan pocos cupos (' + quedan + ')' : 'Cupos disponibles: ' + quedan

  return (
    <>
      <h2>Próximo evento</h2>
      <div className="card row" style={{ flexWrap: 'nowrap', gap: 12 }}>
        <div className="fecha-evento"><b>{dia}</b><span>{mes}</span></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>{ev.titulo}</b>
          <p className="mu">{hora} h{cupos ? ' · ' + cupos : ''}</p>
          {ev.descripcion && <p className="mu">{ev.descripcion}</p>}
        </div>
        <button className="btn" disabled={!ev.anotado && quedan === 0} onClick={alternar}>
          {ev.anotado ? 'Cancelar inscripción' : 'Anotarme'}
        </button>
      </div>
      {ev.anotado && <p className="msg ok">Estás anotado en este evento.</p>}
      <Msg m={msg} />
    </>
  )
}

function Novedades() {
  const [lista, setLista] = useState(null)
  useEffect(() => {
    supabase.from('novedades').select('*').eq('publicada', true)
      .order('creado_en', { ascending: false }).limit(5)
      .then(({ data }) => setLista(data || []))
  }, [])

  if (!lista) return null
  return (
    <>
      <h2>Novedades</h2>
      {lista.length === 0 && <p className="mu">Todavía no hay novedades.</p>}
      {lista.map((n) => (
        <div key={n.id} className="card">
          <b>{n.titulo}</b>
          <p className="mu">{fechaHora(n.creado_en)}</p>
          {n.texto && <p style={{ marginTop: 6, whiteSpace: 'pre-line' }}>{n.texto}</p>}
        </div>
      ))}
    </>
  )
}

// Pedidos que el vendedor ya aceptó y todavía no se entregaron.
function PedidosEnCamino({ perfil }) {
  const [filas, setFilas] = useState([])
  useEffect(() => {
    supabase.from('pedidos').select('id, numero, entrega, productor_id, productores(cerveceria)')
      .eq('socio_id', perfil.id).eq('estado', 'aceptado').order('creado_en')
      .then(({ data }) => setFilas(data || []))
  }, [perfil.id])
  if (filas.length === 0) return null
  return (
    <>
      <h2>Tus pedidos</h2>
      {filas.map((f) => (
        <div key={f.id} className="card row">
          <div>
            <b>Pedido N.º {f.numero}</b>
            {f.productor_id && f.productores && <p className="mu">{f.productores.cerveceria}</p>}
          </div>
          <span className="pill warn">{f.entrega === 'envio' ? 'Envío en proceso' : 'Listo para retirar'}</span>
        </div>
      ))}
    </>
  )
}

function MisDatos({ p, onListo }) {
  const [nombre, setNombre] = useState(p.nombre || '')
  const [apellido, setApellido] = useState(p.apellido || '')
  const [msg, setMsg] = useState(null)

  async function guardar(e) {
    e.preventDefault()
    setMsg(null)
    const { error } = await supabase.rpc('guardar_mis_datos', { p_nombre: nombre, p_apellido: apellido })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: 'Datos guardados.' })
    onListo()
  }

  return (
    <form onSubmit={guardar}>
      <label htmlFor="md-n">Nombre</label>
      <input id="md-n" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
      <label htmlFor="md-a">Apellido</label>
      <input id="md-a" value={apellido} onChange={(e) => setApellido(e.target.value)} />
      <button className="btn pri" style={{ marginTop: 12 }}>Guardar</button>
      <Msg m={msg} />
    </form>
  )
}
