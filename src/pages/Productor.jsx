// Pantalla del productor: inicio, pedidos, productos, rendición mensual y datos de su cervecería.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import MiUsuario from '../MiUsuario'
import Reloj from '../Reloj'
import { Msg, Navegacion, fmt, plata, fechaHora, cap, imprimirTicket } from '../ui'
import { subirImagenProducto } from '../imagenes'
import TiendaControl from '../TiendaControl'
import { CamposProducto } from './Panel'
import { datosPromo } from '../promos'
import ProductoPlegable from '../ProductoPlegable'
import EscanerProductor from '../EscanerProductor'
import AvisosProductor from '../AvisosProductor'
import { QrIdentificacion } from '../Entradas'
import { textoPresentismo } from '../FichaProductor'
import { AvisosRecordatorio } from '../AvisosActivar'
import { InstalarRecordatorio } from '../InstalarApp'
import { BotonBuscar, BotonUbicacion, linkMapas } from '../Direcciones'

const PAGO_TXT = { efectivo: 'Efectivo', transferencia: 'Transferencia', puntos: 'Puntos' }
const pesos = (n) => '$ ' + plata(n)
const ESTADOS = {
  pendiente: ['warn', 'Pendiente'], aceptado: ['warn', 'En proceso'], confirmado: ['ok', 'Entregado'],
  no_entregado: ['bad', 'No entregado'], rechazado: ['bad', 'Rechazado'], vencido: ['bad', 'Sin respuesta'], cancelado: ['bad', 'Cancelado'],
}
const LIMITE_MIN = 30
const ZONA = 'America/Argentina/Buenos_Aires'
const mesTxt = (iso) => cap(new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }))
const diasDesde = (ts) => Math.floor((Date.now() - new Date(ts).getTime()) / 86400000)

export default function Productor({ perfil }) {
  const [vista, setVista] = useState('inicio')
  const [filtro, setFiltro] = useState('amarillo')
  const [periodo, setPeriodo] = useState('mes')
  const irAPedidos = (f) => { setFiltro(f); setVista('pedidos') }
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
      {vista === 'inicio' && <Inicio perfil={perfil} inicio={inicio} error={error} irA={setVista} pedidos={pedidos} datos={datos} periodo={periodo} irAPedidos={irAPedidos} />}
      {vista === 'pedidos' && <Pedidos pedidos={pedidos} resumen={resumen} datos={datos} error={error} recargar={cargar} filtro={filtro} setFiltro={setFiltro} periodo={periodo} setPeriodo={setPeriodo} />}
      {vista === 'productos' && <Productos perfil={perfil} datos={datos} oculto={!!(inicio && inicio.oculto)} />}
      {vista === 'cuenta' && <Cuenta perfil={perfil} inicio={inicio} datos={datos} />}
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

// Semáforo de pedidos: verde = entregados (cerrados), amarillo = esperan aceptación o entrega, rojo = no se concretaron.
const ROJOS = ['rechazado', 'vencido', 'no_entregado', 'cancelado']
const esDelMes = (ts) => { const d = new Date(ts), h = new Date(); return d.getMonth() === h.getMonth() && d.getFullYear() === h.getFullYear() }
function grupos(pedidos, periodo) {
  const en = (p) => periodo === 'todos' || esDelMes(p.creado_en)
  return {
    verde: pedidos.filter((p) => p.estado === 'confirmado' && en(p)),
    amarillo: pedidos.filter((p) => p.estado === 'pendiente' || p.estado === 'aceptado'),
    rojo: pedidos.filter((p) => ROJOS.includes(p.estado) && en(p)),
  }
}
const COLORES = {
  verde: { fondo: '#2e9d57', texto: '#fff', nombre: 'Entregados' },
  amarillo: { fondo: '#f0b429', texto: '#1b1400', nombre: 'Pendientes' },
  rojo: { fondo: '#d64545', texto: '#fff', nombre: 'Cancelados' },
}
function Semaforo({ g, filtro, onElegir }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, margin: '10px 0' }}>
      {['verde', 'amarillo', 'rojo'].map((k) => (
        <button key={k} type="button" onClick={() => onElegir(k)} aria-pressed={filtro === k}
          style={{ background: COLORES[k].fondo, color: COLORES[k].texto, border: filtro === k ? '3px solid var(--tx, #fff)' : '3px solid transparent', borderRadius: 14, padding: '12px 4px', cursor: 'pointer', font: 'inherit' }}>
          <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{g[k].length}</div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{COLORES[k].nombre}</div>
        </button>
      ))}
    </div>
  )
}

// Lo primero que ve el productor: avisos, tienda, resumen del mes y eventos.
function Inicio({ perfil, inicio, error, irA, pedidos, datos, periodo, irAPedidos }) {
  const [eventos, setEventos] = useState([])
  const [presen, setPresen] = useState(null)
  useEffect(() => { supabase.rpc('presentismo_productor').then(({ data }) => setPresen(data || null)) }, [])
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
      <InstalarRecordatorio />
      <AvisosRecordatorio />
      <div className="member" style={{ position: 'relative' }}>
        <QrIdentificacion codigo={perfil.codigo_qr} prefijo="PRO-" etiqueta="productor" />
        <div style={{ paddingRight: 112 }}>
        <p className="mu" style={{ margin: 0 }}>Cervecería</p>
        <h2 style={{ margin: '2px 0 8px' }}>{(datos && datos.cerveceria) || 'Sin nombre cargado'}</h2>
        <p style={{ margin: '4px 0' }}><span className="pill ok">Productor</span></p>
        <p style={{ margin: '4px 0' }}><b>Socio N.º {perfil.numero_socio != null ? String(perfil.numero_socio).padStart(4, '0') : '—'}</b></p>
        <p className="mu">{[perfil.nombre, perfil.apellido].filter(Boolean).join(' ') || 'Sin nombre'}</p>
        {perfil.usuario && <p className="mu">Usuario: {perfil.usuario}</p>}
        {datos && datos.whatsapp && <p className="mu">WhatsApp: {datos.whatsapp}</p>}
        {presen && <p className="mu">Presentismo: {textoPresentismo(presen)}</p>}
        </div>
        <Semaforo g={grupos(pedidos || [], periodo)} filtro={null} onElegir={irAPedidos} />
        <p className="mu" style={{ fontSize: 12 }}>Entregados y cancelados: de este mes. Pendientes: todos los que esperan respuesta o entrega.</p>
      </div>
      <EscanerProductor />
      <AvisosProductor />
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
              <p className="mu">
                {cap(new Date(e.fecha).toLocaleString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: ZONA }))} h
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

function Pedidos({ pedidos, resumen, datos, error, recargar, filtro, setFiltro, periodo, setPeriodo }) {
  const [msg, setMsg] = useState(null)
  const [ahora, setAhora] = useState(Date.now())
  const [cuantos, setCuantos] = useState(10)
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
  const g = grupos(pedidos, periodo)
  const lista = filtro === 'verde' ? g.verde : g.rojo
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

      <Semaforo g={g} filtro={filtro} onElegir={(k) => { setFiltro(k); setCuantos(10) }} />
      {filtro !== 'amarillo' && (
        <div className="chips" style={{ marginTop: 0 }}>
          <button type="button" className={'chip' + (periodo === 'mes' ? ' on' : '')} onClick={() => { setPeriodo('mes'); setCuantos(10) }}>Este mes</button>
          <button type="button" className={'chip' + (periodo === 'todos' ? ' on' : '')} onClick={() => { setPeriodo('todos'); setCuantos(10) }}>Todos</button>
        </div>
      )}
      {filtro === 'amarillo' && <>
      <h2>Para responder</h2>
      {pendientes.length === 0 && <p className="mu">No tenés pedidos pendientes.</p>}
      {pendientes.map((p) => {
        return (
          <div key={p.id} className="card" style={{ borderColor: 'var(--am)' }}>
            <div className="row"><b>Pedido N.º {p.numero}</b><span className="mu">{fechaHora(p.creado_en)}</span></div>
            <Reloj creado={p.creado_en} />
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

      </>}

      {filtro !== 'amarillo' && <>
      <h2>{filtro === 'verde' ? 'Entregados' : 'Cancelados'}</h2>
      {lista.length === 0 && <p className="mu">{filtro === 'verde' ? 'No hay pedidos entregados' : 'No hay pedidos cancelados'}{periodo === 'mes' ? ' este mes.' : '.'}</p>}
      {lista.slice(0, cuantos).map((p) => {
        const [clase, texto] = ESTADOS[p.estado] || ['bad', p.estado]
        return (
          <div key={p.id} className="card">
            <div className="row"><b>Pedido N.º {p.numero}</b><span className={'pill ' + clase}>{texto}</span></div>
            <p className="mu">{fechaHora(p.creado_en)} · Socio N.º {String(p.socio_numero).padStart(4, '0')}</p>
            {items(p)}
          </div>
        )
      })}
      {cuantos < lista.length && (
        <button type="button" className="btn" style={{ width: '100%' }} onClick={() => setCuantos(cuantos + 10)}>
          Ver más ({lista.length - cuantos} restantes)
        </button>
      )}
      </>}
    </>
  )
}

const datosProducto = (r) => ({
  seccion: r.seccion, nombre: r.nombre.trim(),
  formato: r.formato && r.formato.trim() ? r.formato.trim() : null,
  formato_id: r.formato_id || null,
  estilo_id: r.estilo_id || null,
  descripcion: r.descripcion && r.descripcion.trim() ? r.descripcion.trim() : null,
  precio_pesos: Number(r.precio_pesos),
  stock: Math.max(0, Math.floor(Number(r.stock || 0))),
  imagen_url: r.imagen_url || null,
  ...datosPromo(r),
})

function Productos({ perfil, datos, oculto }) {
  const [abierto, setAbierto] = useState(null)
  const vacio = { seccion: 'cervezas', nombre: '', formato: '', formato_id: null, descripcion: '', precio_pesos: '', stock: '', imagen_url: null }
  const [formatos, setFormatos] = useState([])
  const [estilos, setEstilos] = useState([])
  const [secciones, setSecciones] = useState([])
  const [lista, setLista] = useState([])
  const [nuevo, setNuevo] = useState(vacio)
  const [msg, setMsg] = useState(null)

  const cargar = useCallback(async () => {
    const [s, p, f, es] = await Promise.all([
      supabase.from('tienda_secciones').select('*').order('orden'),
      supabase.from('tienda_productos').select('*').eq('productor_id', perfil.id).order('nombre'),
      supabase.from('tienda_formatos').select('*').order('id'),
      supabase.from('tienda_estilos').select('*').order('nombre'),
    ])
    setSecciones(s.data || [])
    setLista(p.data || [])
    setFormatos(f.data || [])
    setEstilos(es.data || [])
  }, [perfil.id])
  useEffect(() => { cargar() }, [cargar])
  useEffect(() => {
    if (secciones.length && !secciones.some((s) => s.id === nuevo.seccion)) setNuevo((n) => ({ ...n, seccion: secciones[0].id }))
  }, [secciones, nuevo.seccion])

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
      <p className="mu">El precio en puntos se calcula solo: es el precio en pesos con un 10% de descuento, pasado a puntos con el valor del punto para el cliente (que fija el administrador).</p>
      {sinNombre
        ? <p className="msg error">Primero cargá el nombre de tu cervecería en Datos: es el que ven los socios en cada producto.</p>
        : (
          <form className="card" onSubmit={agregar}>
            <h3>Agregar producto</h3>
            <CamposProducto r={nuevo} set={(c, v) => setNuevo((n) => ({ ...n, [c]: v }))} secciones={secciones} formatos={formatos} estilos={estilos} id="nuevo"
              onImagen={(f) => cambiarImagen(f, (url) => setNuevo((n) => ({ ...n, imagen_url: url })))} />
            <button className="btn pri" style={{ marginTop: 16 }}>Agregar producto</button>
          </form>
        )}
      <Msg m={msg} />
      {lista.length === 0 && <p className="mu">Todavía no cargaste productos.</p>}
      {lista.map((r) => (
        <ProductoPlegable key={r.id} r={r} abierto={abierto === r.id} onToggle={() => setAbierto(abierto === r.id ? null : r.id)}>
          <CamposProducto r={r} set={(c, v) => editar(r.id, c, v)} secciones={secciones} formatos={formatos} estilos={estilos} id={r.id}
            onImagen={(f) => cambiarImagen(f, (url) => editar(r.id, 'imagen_url', url))} />
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className={'chip' + (r.activo ? ' on' : '')} onClick={() => editar(r.id, 'activo', !r.activo)}>
              {r.activo ? 'Visible para los socios' : 'Oculto'}
            </button>
            <button type="button" className="btn pri" onClick={() => guardar(r)}>Guardar cambios</button>
          </div>
        </ProductoPlegable>
      ))}
    </>
  )
}

// Cuánto se queda la aplicación este mes, separado entre ventas en pesos/transferencia y ventas en puntos.
function QuedaApp({ inicio }) {
  const pct = Number(inicio.porcentaje) || 0
  const pesosV = Number(inicio.efectivo_mes) || 0
  const ptsV = Number(inicio.puntos_mes_pesos) || 0
  const comPesos = pesosV * pct / 100
  const comPts = ptsV * pct / 100
  const Parte = ({ titulo, vendido, com, nota }) => (
    <div style={{ marginTop: 10 }}>
      <b>{titulo}</b>
      <div className="row"><span>Vendiste</span><b>{pesos(vendido)}</b></div>
      <div className="row"><span>La app se queda ({pct}%)</span><b style={{ color: 'var(--am)' }}>{pesos(com)}</b></div>
      <div className="row"><span>Te queda a vos</span><b className="pts">{pesos(vendido - com)}</b></div>
      {nota && <p className="mu">{nota}</p>}
    </div>
  )
  return (
    <div className="card">
      <div className="row"><h3>Cuánto se queda la app este mes</h3></div>
      <Parte titulo="Ventas en pesos o transferencia" vendido={pesosV} com={comPesos} />
      <Parte titulo="Ventas en puntos" vendido={ptsV} com={comPts}
        nota={fmt(inicio.puntos_mes) + ' puntos, a ' + pesos(inicio.valor_punto) + ' cada uno. El club te los paga en la rendición.'} />
      <hr style={{ borderColor: 'var(--line, #333)', margin: '12px 0' }} />
      <div className="row"><b>Total que se queda la app</b><b style={{ color: 'var(--am)' }}>{pesos(comPesos + comPts)}</b></div>
      <div className="row"><b>Total que te queda</b><b className="pts">{pesos(pesosV + ptsV - comPesos - comPts)}</b></div>
      <p className="mu">Cuentan los pedidos entregados del mes en curso. Es un estimado hasta que cierra el mes.</p>
    </div>
  )
}

// Rendición mensual: porcentaje pactado sobre el ingreso, menos el valor de los puntos obtenidos.
function Cuenta({ perfil, inicio, datos }) {
  const [tickets, setTickets] = useState(null)
  const [presen, setPresen] = useState(null)
  useEffect(() => { supabase.rpc('presentismo_productor').then(({ data }) => setPresen(data || null)) }, [])
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
      {inicio && <QuedaApp inicio={inicio} />}
      <h3 style={{ marginTop: 14 }}>Presentismo en Eventos de Cerveceros</h3>
      {presen && (
        <div className="card">
          <p><b>{textoPresentismo(presen)}</b></p>
          <p className="mu">Cuentan los eventos de Cerveceros que ya pasaron y se hicieron después de tu alta. El personal te marca presente al escanear tu QR.</p>
          {presen.detalle.length === 0 && <p className="mu">Todavía no hubo eventos desde tu alta.</p>}
          {presen.detalle.map((e) => (
            <div key={e.id} className="row" style={{ padding: '4px 0' }}>
              <span>{e.titulo} <span className="mu">· {new Date(e.fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric', year: '2-digit', timeZone: ZONA })}</span></span>
              <span className={'pill ' + (e.presente ? 'ok' : 'bad')}>{e.presente ? 'Estuviste' : 'No estuviste'}</span>
            </div>
          ))}
        </div>
      )}
      <h3 style={{ marginTop: 14 }}>Rendiciones</h3>
      {tickets === null && <p className="mu">Cargando...</p>}
      {tickets && tickets.length === 0 && <p className="mu">Todavía no tenés rendiciones. La primera se genera el día 1 del mes siguiente.</p>}
      {(tickets || []).map((t) => {
        const res = Number(t.resultado)
        return (
          <div key={t.id} className="card">
            <div className="row">
              <b>Ticket N.º {t.id} · {mesTxt(t.periodo)}</b>
              <span className={'pill ' + (t.estado === 'pagado' ? 'ok' : 'warn')}>{t.estado === 'pagado' ? 'Pagado' : 'Pendiente'}</span>
            </div>
            <p>Pedidos entregados: {t.pedidos}</p>
            <p>Cobrado en pesos: {pesos(t.ingreso_pesos)}</p>
            <p>Puntos obtenidos: {fmt(t.puntos)} (valen {pesos(t.puntos_pesos)})</p>
            <p>Ingreso total: {pesos(Number(t.ingreso_pesos) + Number(t.puntos_pesos))}</p>
            <p>{t.porcentaje}% acordado: {pesos(t.comision)}</p>
            <p><b>{res > 0 ? 'A pagar por vos: ' + pesos(res) : res < 0 ? 'A pagar por el club: ' + pesos(-res) : 'Sin saldo'}</b></p>
            {t.estado === 'pagado' && t.pagado_en && <p className="mu">Pagado el {fechaHora(t.pagado_en)}.</p>}
            <button type="button" className="btn" style={{ marginTop: 8 }} onClick={() => imprimirTicket(t, datos && datos.cerveceria)}>Imprimir / PDF</button>
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
      <UbicacionEnvios perfil={perfil} tieneNombre={!!(datos && datos.cerveceria && datos.cerveceria.trim())} />
      <div className="card">
        <h3>Mi usuario</h3>
        <MiUsuario actual={perfil.usuario} />
      </div>
    </>
  )
}

// Dirección de la cervecería (oculta para los clientes salvo que se tilde mostrarla) y radio de envío.
function UbicacionEnvios({ perfil, tieneNombre }) {
  const [f, setF] = useState(null)
  const [activa, setActiva] = useState(null)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    supabase.from('productor_ubicacion').select('*').eq('productor_id', perfil.id).maybeSingle().then(({ data }) => {
      setF({
        direccion: (data && data.direccion) || '',
        lat: data && data.lat != null ? Number(data.lat) : null,
        lng: data && data.lng != null ? Number(data.lng) : null,
        publica: !!(data && data.direccion_publica),
        radio: data && data.radio_envio_km != null ? String(Number(data.radio_envio_km)) : '',
      })
    })
    supabase.rpc('cercania_activa').then(({ data }) => setActiva(!!data))
  }, [perfil.id])

  if (!f) return null

  async function guardar(e) {
    e.preventDefault()
    setMsg(null)
    const r = f.radio.trim() === '' ? null : Number(f.radio.replace(',', '.'))
    if (r !== null && (!Number.isFinite(r) || r < 0 || r > 500)) return setMsg({ tipo: 'error', texto: 'El radio de envío tiene que ser un número entre 0 y 500 km.' })
    if (f.direccion.trim() && f.lat == null) return setMsg({ tipo: 'error', texto: 'Tocá "Buscar dirección" o "Usar mi ubicación" para ubicar la dirección en el mapa.' })
    if (r !== null && r > 0 && f.lat == null) return setMsg({ tipo: 'error', texto: 'Para elegir un radio de envío cargá primero tu dirección.' })
    const { error } = await supabase.rpc('guardar_mi_ubicacion', {
      p_direccion: f.direccion.trim() || null, p_lat: f.lat, p_lng: f.lng, p_publica: f.publica, p_radio: r,
    })
    setMsg(error ? { tipo: 'error', texto: error.message } : { tipo: 'ok', texto: 'Guardado.' })
  }

  return (
    <form className="card" onSubmit={guardar}>
      <h3>Ubicación y envíos</h3>
      <p className="mu">
        Se usa para mostrarle a cada cliente qué tan cerca estás y hasta dónde enviás. Tu dirección <b>no se muestra</b> a los clientes: solo ven la distancia en kilómetros, salvo que actives la opción de mostrarla.
        {activa === false && ' Por ahora el club no activó esta función; cuando la active, los datos que cargues ya van a estar listos.'}
      </p>
      <label htmlFor="ub-dir">Dirección de tu cervecería</label>
      <input id="ub-dir" placeholder="Calle, número y localidad" value={f.direccion}
        onChange={(e) => setF({ ...f, direccion: e.target.value, lat: null, lng: null })} />
      <BotonBuscar texto={f.direccion} onResultado={(r) => setF({ ...f, direccion: r.direccion, lat: r.lat, lng: r.lng })} />
      <BotonUbicacion onResultado={(r) => setF({ ...f, direccion: r.direccion, lat: r.lat, lng: r.lng })} />
      {f.lat != null && <p className="mu" style={{ marginTop: 6 }}>Ubicada en el mapa. <a href={linkMapas(f.lat, f.lng)} target="_blank" rel="noreferrer">Ver en el mapa</a> (solo la ves vos).</p>}
      {f.direccion.trim() && f.lat == null && <p className="mu" style={{ marginTop: 6 }}>Falta ubicarla: tocá Buscar dirección.</p>}
      <label className="row" style={{ justifyContent: 'flex-start', gap: 8, marginTop: 12 }}>
        <input type="checkbox" style={{ width: 'auto' }} checked={f.publica} disabled={!f.direccion.trim()}
          onChange={(e) => setF({ ...f, publica: e.target.checked })} />
        <span>Mostrar mi dirección a los clientes</span>
      </label>
      <label htmlFor="ub-radio" style={{ marginTop: 12 }}>Radio de envío (km)</label>
      <input id="ub-radio" inputMode="decimal" placeholder="Vacío = sin límite · 0 = no hago envíos" value={f.radio}
        onChange={(e) => setF({ ...f, radio: e.target.value })} />
      <p className="mu" style={{ marginTop: 6 }}>
        Dejalo vacío para enviar a cualquier distancia, o poné 0 si no hacés envíos. Fuera de tu radio, el cliente solo puede elegir retiro en el local. Se mide en línea recta, no por calles.
      </p>
      <button className="btn pri" style={{ marginTop: 16 }} disabled={!tieneNombre}>Guardar</button>
      {!tieneNombre && <p className="mu">Primero guardá el nombre de tu cervecería arriba.</p>}
      <Msg m={msg} />
    </form>
  )
}
