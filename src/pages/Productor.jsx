// Pantalla del productor: inicio, pedidos, productos, rendición mensual y datos de su cervecería.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Msg, Navegacion, fmt, fechaHora } from '../ui'
import { subirImagenProducto } from '../imagenes'
import TiendaControl from '../TiendaControl'
import { CamposProducto } from './Panel'

const PAGO_TXT = { efectivo: 'Efectivo', transferencia: 'Transferencia', puntos: 'Puntos' }
const pesos = (n) => '$ ' + fmt(n)
const ESTADOS = {
  pendiente: ['warn', 'Pendiente'], aceptado: ['warn', 'En proceso'], confirmado: ['ok', 'Entregado'],
  no_entregado: ['bad', 'No entregado'], rechazado: ['bad', 'Rechazado'], vencido: ['bad', 'Sin respuesta'], cancelado: ['bad', 'Cancelado'],
}
const LIMITE_MIN = 30
const ZONA = 'America/Argentina/Buenos_Aires'
const mesTxt = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
const diasDesde = (ts) => Math.floor((Date.now() - new Date(ts).getTime()) / 86400000)

export default function Productor({ perfil }) {
  const [vista, setVista] = useState('inicio')
  const [pedidos, setPedidos] = useState(null)
  const [resumen, setResumen] = useState(null)
  const [inicio, setInicio] = useState(null)
  const [datos, setDatos] = useState(undefined)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    const [p, r, d, i] = await Promise.all([
      supabase.rpc('mis_pedidos_productor'),
      supabase.rpc('resumen_productores', { p_id: perfil.id }),
      supabase.from('productores').select('*').eq('id', perfil.id).maybeSingle(),
      supabase.rpc('inicio_productor'),
    ])
    setError(p.error ? p.error.message : i.error ? i.error.message : null)
    setPedidos(p.data || [])
    setResumen(r.data && r.data[0] ? r.data[0] : null)
    setDatos(d.data || null)
    setInicio(i.data || null)
  }, [perfil.id])

  // Se actualiza solo cada 30 segundos para que los pedidos nuevos aparezcan con el aviso.
  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 30000)
    return () => clearInterval(t)
  }, [cargar])

  const pendientes = (pedidos || []).filter((p) => p.estado === 'pendiente').length

  return (
    <>
      {vista === 'inicio' && <Inicio perfil={perfil} inicio={inicio} error={error} irA={setVista} />}
      {vista === 'pedidos' && <Pedidos pedidos={pedidos} resumen={resumen} datos={datos} error={error} recargar={cargar} />}
      {vista === 'productos' && <Productos perfil={perfil} datos={datos} oculto={!!(inicio && inicio.oculto)} />}
      {vista === 'cuenta' && <Cuenta perfil={perfil} inicio={inicio} />}
      {vista === 'datos' && <Datos perfil={perfil} datos={datos} onGuardado={cargar} />}
      <Navegacion
        items={[
          ['inicio', 'Inicio', 'hop'], ['pedidos', 'Pedidos', 'pint', pendientes],
          ['productos', 'Productos', 'barrel'], ['cuenta', 'Cuenta', 'crown'], ['datos', 'Datos', 'recarga'],
        ]}
        actual={vista} onElegir={setVista} />
    </>
  )
}

// Lo primero que ve el productor: avisos, tienda, resumen del mes y eventos.
function Inicio({ perfil, inicio, error, irA }) {
  const [eventos, setEventos] = useState([])
  useEffect(() => {
    supabase.from('eventos_productores').select('*').gte('fecha', new Date().toISOString()).order('fecha')
      .then(({ data }) => setEventos(data || []))
  }, [])

  if (!inicio) return <><h2 style={{ marginTop: 6 }}>Inicio</h2>{error && <p className="msg error">{error}</p>}<p className="mu">Cargando...</p></>

  const r = inicio.rendicion
  let aviso = null
  if (r) {
    const mes = mesTxt(r.periodo)
    if (Number(r.resultado) < 0) {
      aviso = ['ok', 'La rendición de ' + mes + ' da a tu favor: el club te debe ' + pesos(-r.resultado) + '.']
    } else if (inicio.oculto) {
      aviso = ['error', 'Tus productos están ocultos para los socios. Se vuelven a mostrar cuando el administrador registre el pago de la rendición de ' + mes + ' (' + pesos(r.resultado) + ').']
    } else {
      const d = r.dias_restantes
      aviso = [d <= 5 ? 'error' : 'ok', 'Tenés que pagar la rendición de ' + mes + ': ' + pesos(r.resultado) + '. ' +
        (d > 0 ? 'Te quedan ' + d + (d === 1 ? ' día' : ' días') + ' antes de que se oculten tus productos.' : 'Hoy es el último día antes de que se oculten tus productos.')]
    }
  }
  const est = Number(inicio.resultado_estimado)

  return (
    <>
      <h2 style={{ marginTop: 6 }}>Inicio</h2>
      {error && <p className="msg error">{error}</p>}
      {aviso && (
        <div className="card" style={{ borderColor: 'var(--am)' }}>
          <p className={'msg ' + aviso[0]}>{aviso[1]}</p>
          <button className="btn pri" style={{ marginTop: 8 }} onClick={() => irA('cuenta')}>Ver mi cuenta</button>
        </div>
      )}
      {inicio.pendientes > 0 && (
        <div className="card" style={{ borderColor: 'var(--am)' }}>
          <p><b>{inicio.pendientes}</b> {inicio.pendientes === 1 ? 'pedido espera' : 'pedidos esperan'} tu respuesta.</p>
          <button className="btn pri" style={{ marginTop: 8 }} onClick={() => irA('pedidos')}>Ver pedidos</button>
        </div>
      )}
      {inicio.sin_cerrar > 0 && (
        <div className="card" style={{ borderColor: 'var(--am)' }}>
          <p className="msg error">Tenés {inicio.sin_cerrar} {inicio.sin_cerrar === 1 ? 'pedido aceptado' : 'pedidos aceptados'} hace más de 7 días sin cerrar. Marcá si se entregaron o no.</p>
          <button className="btn" style={{ marginTop: 8 }} onClick={() => irA('pedidos')}>Ir a pedidos</button>
        </div>
      )}

      <TiendaControl productorId={perfil.id} titulo="Mi tienda" propia />

      <div className="card">
        <h3>Este mes</h3>
        <p>Efectivo y transferencias recaudados: <b>{pesos(inicio.efectivo_mes)}</b></p>
        <p>Puntos obtenidos: <b className="pts">{fmt(inicio.puntos_mes)}</b> (valen {pesos(inicio.puntos_mes_pesos)})</p>
        <p>Ingreso del mes: <b>{pesos(inicio.ingreso_mes)}</b></p>
        <p className="mu">Cuentan los pedidos que marcás como entregados.</p>
        {Number(inicio.valor_punto) === 0 && <p className="mu">El administrador todavía no cargó el valor del punto.</p>}
      </div>
      <div className="card">
        <h3>Rendición estimada del mes</h3>
        <p className="pts" style={{ fontSize: 28 }}>{pesos(Math.abs(est))}</p>
        <p>{est > 0 ? 'A pagar por vos' : est < 0 ? 'A pagar por el club' : 'Sin saldo'}</p>
        <p className="mu">
          Es el {inicio.porcentaje}% de tu ingreso ({pesos(inicio.comision_estimada)}) menos el valor de tus puntos ({pesos(inicio.puntos_mes_pesos)}).
          Sube con cada entrega y queda firme cuando cierra el mes.
        </p>
      </div>

      {eventos.length > 0 && (
        <>
          <h2>Eventos de Cerveceros</h2>
          {eventos.map((e) => (
            <div key={e.id} className="card">
              <b>{e.titulo}</b>
              <p className="mu" style={{ textTransform: 'capitalize' }}>
                {new Date(e.fecha).toLocaleString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: ZONA })} h
                {e.lugar ? ' · ' + e.lugar : ''}
              </p>
              {e.descripcion && <p>{e.descripcion}</p>}
            </div>
          ))}
        </>
      )}
    </>
  )
}

function Pedidos({ pedidos, resumen, datos, error, recargar }) {
  const [msg, setMsg] = useState(null)
  const [ahora, setAhora] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 20000)
    return () => clearInterval(t)
  }, [])

  const TEXTOS = {
    aceptado: 'Pedido aceptado. Cuando lo entregues, marcalo como entregado.',
    confirmado: 'Pedido entregado: ya cuenta en tu facturación.',
    no_entregado: 'Marcado como no entregado: se devolvieron el stock y los puntos.',
    rechazado: 'Pedido rechazado: stock y puntos devueltos.',
  }

  async function resolver(p, accion) {
    if (accion === 'rechazar' && !window.confirm('¿Rechazar el pedido N.º ' + p.numero + '? Se devuelven el stock y, si pagó con puntos, los puntos.')) return
    if (accion === 'no_entregado' && !window.confirm('¿Marcar el pedido N.º ' + p.numero + ' como no entregado? No se cobra ni cuenta en la facturación.')) return
    setMsg(null)
    const { data, error: err } = await supabase.rpc('resolver_pedido_productor', { p_id: p.id, p_accion: accion })
    if (err) return setMsg({ tipo: 'error', texto: err.message })
    if (data === 'vencido') {
      setMsg({ tipo: 'error', texto: 'Ese pedido ya venció (pasaron ' + LIMITE_MIN + ' minutos): se canceló y se devolvieron stock y puntos.' })
    } else {
      setMsg({ tipo: 'ok', texto: TEXTOS[data] || 'Listo.' })
    }
    recargar()
  }

  if (pedidos === null) return <p className="mu">Cargando...</p>
  const pendientes = pedidos.filter((p) => p.estado === 'pendiente')
  const enProceso = pedidos.filter((p) => p.estado === 'aceptado')
  const anteriores = pedidos.filter((p) => p.estado !== 'pendiente' && p.estado !== 'aceptado')
  const datosFaltan = datos !== undefined && (!datos || !datos.cerveceria.trim() || !datos.whatsapp)
  const items = (p) => p.items.map((i, k) => <p key={k}>{i.cantidad} × {i.nombre}{i.formato ? ' (' + i.formato + ')' : ''}</p>)
  const total = (p) => (p.pago === 'puntos' ? fmt(p.total_puntos) + ' pts (reservados hasta la entrega)' : pesos(p.total_pesos))

  return (
    <>
      <h2 style={{ marginTop: 6 }}>Pedidos</h2>
      {error && <p className="msg error">No se pudieron cargar los pedidos: {error}</p>}
      {datosFaltan && (
        <p className="msg error">Completá en Datos el nombre de tu cervecería y tu número de WhatsApp: sin eso los socios no pueden avisarte.</p>
      )}

      {resumen && (
        <div className="card">
          <h3>Tu resumen</h3>
          <p>Entregados: <b>{resumen.aceptados}</b> · En proceso: <b>{resumen.en_proceso}</b> · No entregados: <b>{resumen.no_entregados}</b></p>
          <p>Rechazados: <b>{resumen.rechazados}</b> · Sin respuesta: <b>{resumen.vencidos}</b></p>
          <p>Puntos recibidos con tus entregas: <b className="pts">{fmt(resumen.puntos_canjeados)}</b></p>
        </div>
      )}

      <h2>Para responder</h2>
      {pendientes.length === 0 && <p className="mu">No tenés pedidos pendientes.</p>}
      {pendientes.map((p) => {
        const resta = LIMITE_MIN - Math.floor((ahora - new Date(p.creado_en).getTime()) / 60000)
        return (
          <div key={p.id} className="card" style={{ borderColor: 'var(--am)' }}>
            <div className="row"><b>Pedido N.º {p.numero}</b><span className="mu">{fechaHora(p.creado_en)}</span></div>
            <p className={resta <= 5 ? 'msg error' : 'mu'}>
              {resta > 0 ? 'Te quedan ' + resta + ' min para responder.' : 'Se venció el plazo: se cancela en un momento.'}
            </p>
            <p>Socio N.º {String(p.socio_numero).padStart(4, '0')} · {(p.socio_nombre || '').trim() || 'Sin nombre'}</p>
            {items(p)}
            <p className="pts" style={{ marginTop: 6 }}>{total(p)}</p>
            <p className="mu">Pago: {PAGO_TXT[p.pago]} · {p.entrega === 'envio' ? 'Envío a ' + p.direccion : 'Retiro'}</p>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn" onClick={() => resolver(p, 'rechazar')}>Rechazar</button>
              <button className="btn pri" onClick={() => resolver(p, 'aceptar')}>Aceptar pedido</button>
            </div>
          </div>
        )
      })}
      <Msg m={msg} />

      <h2>En proceso</h2>
      {enProceso.length === 0 && <p className="mu">No tenés pedidos en proceso.</p>}
      {enProceso.map((p) => {
        const d = diasDesde(p.aceptado_en)
        return (
          <div key={p.id} className="card">
            <div className="row"><b>Pedido N.º {p.numero}</b><span className="pill warn">{p.entrega === 'envio' ? 'Envío en proceso' : 'Listo para retirar'}</span></div>
            <p className={d >= 7 ? 'msg error' : 'mu'}>Aceptado hace {d === 0 ? 'menos de un día' : d + (d === 1 ? ' día' : ' días')}{d >= 7 ? ': cerralo cuanto antes.' : '.'}</p>
            <p>Socio N.º {String(p.socio_numero).padStart(4, '0')} · {(p.socio_nombre || '').trim() || 'Sin nombre'}</p>
            {items(p)}
            <p className="pts" style={{ marginTop: 6 }}>{total(p)}</p>
            <p className="mu">{p.entrega === 'envio' ? 'Envío a ' + p.direccion : 'Retiro'}. Al marcar entregado se cobra, se descuentan los puntos del socio y cuenta en tu facturación.</p>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn" onClick={() => resolver(p, 'no_entregado')}>No entregado</button>
              <button className="btn pri" onClick={() => resolver(p, 'entregar')}>Entregado</button>
            </div>
          </div>
        )
      })}

      <h2>Anteriores</h2>
      {anteriores.length === 0 && <p className="mu">Todavía no cerraste pedidos.</p>}
      {anteriores.map((p) => {
        const [clase, texto] = ESTADOS[p.estado] || ['bad', p.estado]
        return (
          <div key={p.id} className="card">
            <div className="row"><b>Pedido N.º {p.numero}</b><span className={'pill ' + clase}>{texto}</span></div>
            <p className="mu">{fechaHora(p.creado_en)} · Socio N.º {String(p.socio_numero).padStart(4, '0')}</p>
            {items(p)}
          </div>
        )
      })}
    </>
  )
}

const datosProducto = (r) => ({
  seccion: r.seccion, nombre: r.nombre.trim(),
  formato: r.formato && r.formato.trim() ? r.formato.trim() : null,
  descripcion: r.descripcion && r.descripcion.trim() ? r.descripcion.trim() : null,
  precio_pesos: Number(r.precio_pesos),
  stock: Math.max(0, Math.floor(Number(r.stock || 0))),
  imagen_url: r.imagen_url || null,
})

function Productos({ perfil, datos, oculto }) {
  const vacio = { seccion: 'cervezas', nombre: '', formato: '', descripcion: '', precio_pesos: '', stock: '', imagen_url: null }
  const [secciones, setSecciones] = useState([])
  const [lista, setLista] = useState([])
  const [nuevo, setNuevo] = useState(vacio)
  const [msg, setMsg] = useState(null)

  const cargar = useCallback(async () => {
    const [s, p] = await Promise.all([
      supabase.from('tienda_secciones').select('*').order('orden'),
      supabase.from('tienda_productos').select('*').eq('productor_id', perfil.id).order('nombre'),
    ])
    setSecciones(s.data || [])
    setLista(p.data || [])
  }, [perfil.id])
  useEffect(() => { cargar() }, [cargar])

  const editar = (id, campo, valor) => setLista((l) => l.map((r) => (r.id === id ? { ...r, [campo]: valor } : r)))

  async function cambiarImagen(archivo, alSubir) {
    if (!archivo) return
    setMsg(null)
    try {
      alSubir(await subirImagenProducto(archivo))
      setMsg({ tipo: 'ok', texto: 'Imagen subida. Guardá el producto para aplicarla.' })
    } catch (e) {
      setMsg({ tipo: 'error', texto: e.message })
    }
  }

  async function guardar(r) {
    setMsg(null)
    const { error } = await supabase.from('tienda_productos').update({ ...datosProducto(r), activo: r.activo }).eq('id', r.id)
    setMsg(error ? { tipo: 'error', texto: error.message } : { tipo: 'ok', texto: 'Guardado: ' + r.nombre })
    if (!error) cargar()
  }

  async function agregar(e) {
    e.preventDefault()
    setMsg(null)
    const { error } = await supabase.from('tienda_productos').insert({ ...datosProducto(nuevo), productor_id: perfil.id })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: 'Producto agregado: ' + nuevo.nombre })
    setNuevo(vacio)
    cargar()
  }

  if (datos === undefined) return <p className="mu">Cargando...</p>
  const sinNombre = !datos || !datos.cerveceria.trim()

  return (
    <>
      <h2 style={{ marginTop: 6 }}>Mis productos</h2>
      {oculto && <p className="msg error">Tus productos están ocultos para los socios por la rendición vencida. Mirá Inicio.</p>}
      <p className="mu">El precio en puntos se calcula solo: es el 90% del precio en pesos, pasado a puntos con el valor del punto.</p>
      {sinNombre
        ? <p className="msg error">Primero cargá el nombre de tu cervecería en Datos: es el que ven los socios en cada producto.</p>
        : (
          <form className="card" onSubmit={agregar}>
            <h3>Agregar producto</h3>
            <CamposProducto r={nuevo} set={(c, v) => setNuevo({ ...nuevo, [c]: v })} secciones={secciones} id="nuevo"
              onImagen={(f) => cambiarImagen(f, (url) => setNuevo((n) => ({ ...n, imagen_url: url })))} />
            <button className="btn pri" style={{ marginTop: 16 }}>Agregar producto</button>
          </form>
        )}
      <Msg m={msg} />
      {lista.length === 0 && <p className="mu">Todavía no cargaste productos.</p>}
      {lista.map((r) => (
        <div key={r.id} className="card" style={{ opacity: r.activo ? 1 : 0.6 }}>
          <CamposProducto r={r} set={(c, v) => editar(r.id, c, v)} secciones={secciones} id={r.id}
            onImagen={(f) => cambiarImagen(f, (url) => editar(r.id, 'imagen_url', url))} />
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className={'chip' + (r.activo ? ' on' : '')} onClick={() => editar(r.id, 'activo', !r.activo)}>
              {r.activo ? 'Visible para los socios' : 'Oculto'}
            </button>
            <button type="button" className="btn pri" onClick={() => guardar(r)}>Guardar cambios</button>
          </div>
        </div>
      ))}
    </>
  )
}

// Rendición mensual: porcentaje pactado sobre el ingreso, menos el valor de los puntos obtenidos.
function Cuenta({ perfil, inicio }) {
  const [tickets, setTickets] = useState(null)
  useEffect(() => {
    supabase.from('rendiciones_productor').select('*').eq('productor_id', perfil.id)
      .order('periodo', { ascending: false }).limit(12).then(({ data }) => setTickets(data || []))
  }, [perfil.id])

  return (
    <>
      <h2 style={{ marginTop: 6 }}>Cuenta</h2>
      <p className="mu">
        Cada mes se hace tu rendición: el {inicio ? inicio.porcentaje : '5'}% de lo que facturaste (pesos más puntos), menos lo que valen los puntos que obtuviste.
        Si da positivo, lo pagás vos; si da negativo, te paga el club. Los puntos no se canjean aparte: se descuentan acá.
      </p>
      {tickets === null && <p className="mu">Cargando...</p>}
      {tickets && tickets.length === 0 && <p className="mu">Todavía no tenés rendiciones. La primera se genera el día 1 del mes siguiente.</p>}
      {(tickets || []).map((t) => {
        const res = Number(t.resultado)
        return (
          <div key={t.id} className="card">
            <div className="row">
              <b style={{ textTransform: 'capitalize' }}>Ticket N.º {t.id} · {mesTxt(t.periodo)}</b>
              <span className={'pill ' + (t.estado === 'pagado' ? 'ok' : 'warn')}>{t.estado === 'pagado' ? 'Pagado' : 'Pendiente'}</span>
            </div>
            <p>Pedidos entregados: {t.pedidos}</p>
            <p>Cobrado en pesos: {pesos(t.ingreso_pesos)}</p>
            <p>Puntos obtenidos: {fmt(t.puntos)} (valen {pesos(t.puntos_pesos)})</p>
            <p>Ingreso total: {pesos(Number(t.ingreso_pesos) + Number(t.puntos_pesos))}</p>
            <p>{t.porcentaje}% acordado: {pesos(t.comision)}</p>
            <p><b>{res > 0 ? 'A pagar por vos: ' + pesos(res) : res < 0 ? 'A pagar por el club: ' + pesos(-res) : 'Sin saldo'}</b></p>
            {t.estado === 'pagado' && t.pagado_en && <p className="mu">Pagado el {fechaHora(t.pagado_en)}.</p>}
            {t.estado === 'pendiente' && res > 0 && t.vence_gracia && (
              <p className="mu">Podés seguir vendiendo hasta el {new Date(t.vence_gracia + 'T00:00:00').toLocaleDateString('es-AR')}.</p>
            )}
          </div>
        )
      })}
    </>
  )
}

function Datos({ perfil, datos, onGuardado }) {
  const [cerveceria, setCerveceria] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [msg, setMsg] = useState(null)

  // Se cargan los valores guardados una vez; el refresco automático no pisa lo que se está escribiendo.
  const huella = datos ? datos.actualizado_en : null
  useEffect(() => {
    if (datos) { setCerveceria(datos.cerveceria || ''); setWhatsapp(datos.whatsapp || '') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [huella])

  async function guardar(e) {
    e.preventDefault()
    setMsg(null)
    const nombre = cerveceria.trim()
    const numero = whatsapp.replace(/\D/g, '')
    if (!nombre) return setMsg({ tipo: 'error', texto: 'Escribí el nombre de tu cervecería.' })
    if (numero && (numero.length < 10 || numero.length > 15)) {
      return setMsg({ tipo: 'error', texto: 'El WhatsApp tiene que llevar el código de país y de área, por ejemplo 5492211234567.' })
    }
    const { error } = await supabase.from('productores')
      .upsert({ id: perfil.id, cerveceria: nombre, whatsapp: numero || null, actualizado_en: new Date().toISOString() })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setWhatsapp(numero)
    setMsg({ tipo: 'ok', texto: 'Datos guardados.' })
    onGuardado()
  }

  return (
    <>
      <h2 style={{ marginTop: 6 }}>Datos de mi cervecería</h2>
      <form className="card" onSubmit={guardar}>
        <label htmlFor="pr-cerv">Nombre de la cervecería</label>
        <input id="pr-cerv" value={cerveceria} onChange={(e) => setCerveceria(e.target.value)} required />
        <label htmlFor="pr-wa">WhatsApp donde recibís los pedidos</label>
        <input id="pr-wa" inputMode="numeric" placeholder="5492211234567" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
        <p className="mu" style={{ marginTop: 6 }}>
          Con código de país, sin + ni espacios. En Argentina: 54, un 9, el código de área sin 0 y el número sin 15.
        </p>
        <button className="btn pri" style={{ marginTop: 16 }}>Guardar</button>
        <Msg m={msg} />
      </form>
    </>
  )
}
