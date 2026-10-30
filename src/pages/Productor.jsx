// Pantalla del productor: pedidos que le llegan, sus productos y los datos de su cervecería.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Msg, Navegacion, fmt, fechaHora } from '../ui'
import { subirImagenProducto } from '../imagenes'
import { CamposProducto } from './Panel'

const PAGO_TXT = { efectivo: 'Efectivo', transferencia: 'Transferencia', puntos: 'Puntos' }
const pesos = (n) => '$ ' + fmt(n)
const ESTADOS = {
  pendiente: ['warn', 'Pendiente'], confirmado: ['ok', 'Aceptado'], rechazado: ['bad', 'Rechazado'],
  vencido: ['bad', 'Sin respuesta'], cancelado: ['bad', 'Cancelado'],
}
const LIMITE_MIN = 30

export default function Productor({ perfil }) {
  const [vista, setVista] = useState('pedidos')
  const [pedidos, setPedidos] = useState(null)
  const [resumen, setResumen] = useState(null)
  const [datos, setDatos] = useState(undefined)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    const [p, r, d] = await Promise.all([
      supabase.rpc('mis_pedidos_productor'),
      supabase.rpc('resumen_productores', { p_id: perfil.id }),
      supabase.from('productores').select('*').eq('id', perfil.id).maybeSingle(),
    ])
    setError(p.error ? p.error.message : null)
    setPedidos(p.data || [])
    setResumen(r.data && r.data[0] ? r.data[0] : null)
    setDatos(d.data || null)
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
      {vista === 'pedidos' && <Pedidos pedidos={pedidos} resumen={resumen} datos={datos} error={error} recargar={cargar} />}
      {vista === 'productos' && <Productos perfil={perfil} datos={datos} />}
      {vista === 'datos' && <Datos perfil={perfil} datos={datos} onGuardado={cargar} />}
      <Navegacion
        items={[['pedidos', 'Pedidos', 'pint', pendientes], ['productos', 'Productos', 'barrel'], ['datos', 'Datos', 'hop']]}
        actual={vista} onElegir={setVista} />
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

  async function resolver(p, accion) {
    if (accion === 'rechazar' && !window.confirm('¿Rechazar el pedido N.º ' + p.numero + '? Se devuelven el stock y, si pagó con puntos, los puntos.')) return
    setMsg(null)
    const { data, error: err } = await supabase.rpc('resolver_pedido_productor', { p_id: p.id, p_accion: accion })
    if (err) return setMsg({ tipo: 'error', texto: err.message })
    if (data === 'vencido') {
      setMsg({ tipo: 'error', texto: 'Ese pedido ya venció (pasaron ' + LIMITE_MIN + ' minutos): se canceló y se devolvieron stock y puntos.' })
    } else {
      setMsg({ tipo: 'ok', texto: data === 'confirmado' ? 'Pedido aceptado.' : 'Pedido rechazado: stock y puntos devueltos.' })
    }
    recargar()
  }

  if (pedidos === null) return <p className="mu">Cargando...</p>
  const pendientes = pedidos.filter((p) => p.estado === 'pendiente')
  const anteriores = pedidos.filter((p) => p.estado !== 'pendiente')
  const datosFaltan = datos !== undefined && (!datos || !datos.cerveceria.trim() || !datos.whatsapp)

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
          <p>Aceptados: <b>{resumen.aceptados}</b> · Rechazados: <b>{resumen.rechazados}</b> · Sin respuesta: <b>{resumen.vencidos}</b></p>
          <p>Puntos canjeados con tus productos: <b className="pts">{fmt(resumen.puntos_canjeados)}</b></p>
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
            <p>Socio N.º {String(p.socio_numero).padStart(4, '0')} · {p.socio_nombre || 'Sin nombre'}</p>
            {p.items.map((i, k) => <p key={k}>{i.cantidad} × {i.nombre}{i.formato ? ' (' + i.formato + ')' : ''}</p>)}
            <p className="pts" style={{ marginTop: 6 }}>{p.pago === 'puntos' ? fmt(p.total_puntos) + ' pts (ya descontados)' : pesos(p.total_pesos)}</p>
            <p className="mu">Pago: {PAGO_TXT[p.pago]} · {p.entrega === 'envio' ? 'Envío a ' + p.direccion : 'Retiro'}</p>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn" onClick={() => resolver(p, 'rechazar')}>Rechazar</button>
              <button className="btn pri" onClick={() => resolver(p, 'aceptar')}>Aceptar pedido</button>
            </div>
          </div>
        )
      })}
      <Msg m={msg} />

      <h2>Anteriores</h2>
      {anteriores.length === 0 && <p className="mu">Todavía no resolviste pedidos.</p>}
      {anteriores.map((p) => {
        const [clase, texto] = ESTADOS[p.estado] || ['bad', p.estado]
        return (
          <div key={p.id} className="card">
            <div className="row"><b>Pedido N.º {p.numero}</b><span className={'pill ' + clase}>{texto}</span></div>
            <p className="mu">{fechaHora(p.creado_en)} · Socio N.º {String(p.socio_numero).padStart(4, '0')}</p>
            {p.items.map((i, k) => <p key={k}>{i.cantidad} × {i.nombre}{i.formato ? ' (' + i.formato + ')' : ''}</p>)}
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
  precio_puntos: r.precio_puntos === '' || r.precio_puntos == null ? null : Number(r.precio_puntos),
  stock: Math.max(0, Math.floor(Number(r.stock || 0))),
  imagen_url: r.imagen_url || null,
})

function Productos({ perfil, datos }) {
  const vacio = { seccion: 'cervezas', nombre: '', formato: '', descripcion: '', precio_pesos: '', precio_puntos: '', stock: '', imagen_url: null }
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
