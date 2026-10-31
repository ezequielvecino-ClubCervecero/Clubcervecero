// Pantalla del personal del local y del administrador.
// El administrador ve ademas las pestañas Cuotas y Ajustes y roles.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Icon, Msg, Navegacion, Categoria, CATS, fmt, fechaHora } from '../ui'
import Escaner from '../Escaner'
import MasVendidos from '../MasVendidos'
import { subirImagenProducto } from '../imagenes'
import Movimientos from './Movimientos'
import TiendaControl from '../TiendaControl'

const etiqueta = (s) => `N.º ${String(s.numero_socio).padStart(4, '0')} - ${[s.nombre, s.apellido].filter(Boolean).join(' ') || 'Sin nombre'}`

const ADMIN_MENU = [
  ['socios', 'Socios', 'Puntos y cuota de cada socio', 'crown'],
  ['facturacion', 'Facturación', 'Ventas del mes con detalle', 'crown'],
  ['cuota', 'Cuotas', 'Registrar pagos de cuota', 'crown'],
  ['ajuste', 'Ajustes y roles', 'Ajustar puntos y cambiar roles', 'hop'],
  ['productores', 'Productores', 'Pedidos, ventas y avisos', 'pint'],
  ['puntos', 'Puntos', 'Cuánto suma cada compra y referido', 'crown'],
  ['marca', 'Marca', 'Nombre, logos y WhatsApp', 'barrel'],
]

// El administrador, al tocar Cargar, elige qué cargar.
const CARGA_MENU = [
  ['puntos', 'Cargar puntos', 'Litros y compras extras de un socio', 'recarga'],
  ['premios', 'Premios', 'Catálogo de canjes con puntos', 'gift'],
  ['tienda', 'Tienda', 'Productos, stock y secciones', 'pint'],
  ['eventos', 'Eventos', 'Eventos del club, anotados y Eventos de Cerveceros', 'crown'],
  ['novedades', 'Novedades', 'Anuncios para los socios', 'hop'],
]

export default function Panel({ esAdmin, marca, onMarca }) {
  const [vista, setVista] = useState(esAdmin ? 'cobros' : 'carga')
  const [sub, setSub] = useState(null)
  const [subCarga, setSubCarga] = useState(null)
  const [socios, setSocios] = useState([])
  const [pendientes, setPendientes] = useState(0)

  const cargarSocios = useCallback(async () => {
    const { data } = await supabase
      .from('perfiles')
      .select('id, nombre, apellido, numero_socio, rol, cuota_pagada_hasta')
      .order('numero_socio')
    setSocios(data || [])
  }, [])

  const contarPendientes = useCallback(async () => {
    const cuenta = (tabla) => supabase.from(tabla).select('id', { count: 'exact', head: true }).eq('estado', 'pendiente')
    // Los pedidos de los productores los responde cada productor: acá solo se cuentan los del club.
    const [a, b] = await Promise.all([cuenta('pagos_informados'), cuenta('pedidos').is('productor_id', null)])
    setPendientes((a.count || 0) + (b.count || 0))
  }, [])

  useEffect(() => { cargarSocios() }, [cargarSocios])
  useEffect(() => { contarPendientes() }, [contarPendientes, vista])

  const soloSocios = socios.filter((s) => s.rol === 'socio')
  // El administrador arranca en Cobros; el personal, en Cargar.
  const itemCobros = ['cobros', 'Cobros', 'crown', pendientes]
  const items = esAdmin
    ? [itemCobros, ['carga', 'Cargar', 'recarga'], ['cupon', 'Canjear', 'gift'], ['mov', 'Movimientos', 'barrel'], ['admin', 'Admin', 'hop']]
    : [['carga', 'Cargar', 'recarga'], ['cupon', 'Canjear', 'gift'], itemCobros, ['mov', 'Movimientos', 'barrel']]

  return (
    <>
      {vista === 'carga' && (!esAdmin || subCarga === 'puntos') && (
        <>
          {esAdmin && <button type="button" className="btn" style={{ marginBottom: 12 }} onClick={() => setSubCarga(null)}>← Volver a Cargar</button>}
          <Carga />
        </>
      )}
      {vista === 'carga' && esAdmin && !subCarga && (
        <>
          <h2 style={{ marginTop: 6 }}>Cargar</h2>
          <div className="menu-admin">
            {CARGA_MENU.map(([id, titulo, desc, icono]) => (
              <button key={id} type="button" className="card menu-card" onClick={() => setSubCarga(id)}>
                <Icon name={icono} size={22} /><b>{titulo}</b><span className="mu">{desc}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {vista === 'carga' && esAdmin && subCarga && subCarga !== 'puntos' && (
        <>
          <button type="button" className="btn" style={{ marginBottom: 12 }} onClick={() => setSubCarga(null)}>← Volver a Cargar</button>
          {subCarga === 'premios' && <Premios />}
          {subCarga === 'tienda' && <TiendaAdmin />}
          {subCarga === 'eventos' && <EventosAdmin />}
          {subCarga === 'novedades' && <NovedadesAdmin />}
        </>
      )}
      {vista === 'cupon' && <Cupon />}
      {vista === 'cobros' && <Cobros onCambio={contarPendientes} esAdmin={esAdmin} />}
      {vista === 'mov' && <Movimientos socios={socios} />}
      {vista === 'admin' && esAdmin && !sub && (
        <>
          <h2 style={{ marginTop: 6 }}>Administración</h2>
          <div className="menu-admin">
            {ADMIN_MENU.map(([id, titulo, desc, icono]) => (
              <button key={id} type="button" className="card menu-card" onClick={() => setSub(id)}>
                <Icon name={icono} size={22} /><b>{titulo}</b><span className="mu">{desc}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {vista === 'admin' && esAdmin && sub && (
        <>
          <button type="button" className="btn" style={{ marginBottom: 12 }} onClick={() => setSub(null)}>← Volver al menú</button>
          {sub === 'socios' && <Socios />}
          {sub === 'facturacion' && <Facturacion />}
          {sub === 'cuota' && <Cuotas socios={soloSocios} recargar={cargarSocios} />}
          {sub === 'ajuste' && <Ajustes socios={socios} recargar={cargarSocios} />}
          {sub === 'productores' && <ProductoresAdmin />}
          {sub === 'puntos' && <PuntosAdmin />}
          {sub === 'marca' && <Marca marca={marca} onGuardado={onMarca} />}
        </>
      )}
      <Navegacion items={items} actual={vista} onElegir={(id) => { setVista(id); setSub(null); setSubCarga(null) }} />
    </>
  )
}

function Carga() {
  const [busca, setBusca] = useState('')
  const [socio, setSocio] = useState(null)
  const [litros, setLitros] = useState('')
  const [extras, setExtras] = useState('0')
  const [msg, setMsg] = useState(null)

  async function buscar(e) {
    e.preventDefault()
    setMsg(null)
    setSocio(null)
    const { data, error } = await supabase.rpc('buscar_socio', { p_texto: busca })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    if (!data || data.length === 0) return setMsg({ tipo: 'error', texto: 'No se encontró ningún socio con ese número o apodo.' })
    setSocio(data[0])
  }

  async function confirmar(e) {
    e.preventDefault()
    setMsg(null)
    const { data, error } = await supabase.rpc('registrar_carga', {
      p_socio: socio.id, p_litros: Number(litros || 0), p_unidades_extra: Number(extras || 0),
    })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: 'Carga registrada para ' + etiqueta(socio) + '. Saldo total del socio: ' + fmt(data) + ' puntos.' })
    setSocio(null)
    setBusca('')
    setLitros('')
    setExtras('0')
  }

  return (
    <div className="card">
      <h3>Registrar carga de puntos</h3>
      <p className="mu">Cada punto cargado equivale a 1 litro recargado. Cada compra extra suma 0,25 puntos.</p>
      {!socio && (
        <form onSubmit={buscar}>
          <label htmlFor="c-busca">Número de socio o apodo</label>
          <input id="c-busca" value={busca} onChange={(e) => setBusca(e.target.value)} required />
          <button className="btn pri" style={{ marginTop: 16 }}>Buscar socio</button>
        </form>
      )}
      {socio && (
        <form onSubmit={confirmar}>
          <div className="estado ok" style={{ marginTop: 12 }}>
            <b>Confirmá el socio</b>
            <span>Socio N.º {String(socio.numero_socio).padStart(4, '0')}</span>
            <span>{socio.nombre || 'Sin nombre'}</span>
          </div>
          <label htmlFor="c-litros">Puntos a cargar</label>
          <input id="c-litros" type="number" min="0" step="0.1" value={litros} onChange={(e) => setLitros(e.target.value)} />
          <label htmlFor="c-extras">Compras extras</label>
          <input id="c-extras" type="number" min="0" step="1" value={extras} onChange={(e) => setExtras(e.target.value)} />
          <div className="row" style={{ marginTop: 16 }}>
            <button type="button" className="btn" onClick={() => setSocio(null)}>Cambiar socio</button>
            <button className="btn pri"><Icon name="recarga" size={18} />Confirmar y registrar</button>
          </div>
        </form>
      )}
      <Msg m={msg} />
    </div>
  )
}

function Cupon() {
  const [codigo, setCodigo] = useState('')
  const [cupon, setCupon] = useState(null)
  const [msg, setMsg] = useState(null)
  const [escaneando, setEscaneando] = useState(false)

  const limpiar = () => { setCupon(null); setCodigo('') }

  async function consultar(cod) {
    setMsg(null)
    setCupon(null)
    const { data, error } = await supabase.rpc('ver_cupon', { p_codigo: cod })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setCupon(data)
  }

  function leido(texto) {
    setEscaneando(false)
    setCodigo(texto.slice(0, 8))
    consultar(texto)
  }

  async function aceptar() {
    setMsg(null)
    const { data, error } = await supabase.rpc('canjear_cupon', { p_codigo: cupon.codigo })
    if (error) { setCupon(null); return setMsg({ tipo: 'error', texto: error.message }) }
    setMsg({ tipo: 'ok', texto: 'Canje hecho: entregá "' + cupon.producto + '". Se descontaron ' + fmt(data.puntos) + ' puntos al socio.' })
    limpiar()
  }

  async function rechazar() {
    setMsg(null)
    const { error } = await supabase.rpc('rechazar_cupon', { p_codigo: cupon.codigo })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: 'Cupón cancelado. Los puntos quedaron liberados para el socio.' })
    limpiar()
  }

  return (
    <div className="card">
      <h3>Canjear cupón</h3>
      {!cupon && (
        <>
          <p className="mu" style={{ marginTop: 6 }}>Escaneá el QR del cupón o escribí el código de 8 caracteres.</p>
          {escaneando
            ? <Escaner onLeido={leido} onCerrar={() => setEscaneando(false)} />
            : <button type="button" className="btn pri" style={{ marginTop: 12 }} onClick={() => { setMsg(null); setEscaneando(true) }}>
                <Icon name="gift" size={18} />Escanear con la cámara
              </button>}
          <form onSubmit={(e) => { e.preventDefault(); consultar(codigo.trim()) }}>
            <label htmlFor="cp">Código del cupón</label>
            <input id="cp" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} maxLength={8} required />
            <button className="btn" style={{ marginTop: 12 }}>Ver cupón</button>
          </form>
        </>
      )}
      {cupon && (
        <>
          <div className="estado warn" style={{ marginTop: 12 }}>
            <span>Producto a entregar</span>
            <b style={{ fontSize: 20 }}>{cupon.producto}</b>
            <span>{cupon.categoria} · {fmt(cupon.puntos)} puntos</span>
            <span>Socio N.º {String(cupon.socio_numero).padStart(4, '0')} · {cupon.socio_nombre || 'Sin nombre'}</span>
          </div>
          <p className="mu">Confirmá que tenés este producto disponible antes de aceptar.</p>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" onClick={rechazar}>No hay disponibilidad</button>
            <button className="btn pri" onClick={aceptar}><Icon name="gift" size={18} />Aceptar y canjear</button>
          </div>
          <div style={{ marginTop: 10 }}><button className="btn" onClick={limpiar}>Volver</button></div>
        </>
      )}
      <Msg m={msg} />
    </div>
  )
}

function Cuotas({ socios, recargar }) {
  const [msg, setMsg] = useState(null)
  const [monto, setMonto] = useState(null)
  useEffect(() => {
    supabase.from('configuracion').select('monto_cuota').eq('id', 1).single().then(({ data }) => { if (data) setMonto(data.monto_cuota) })
  }, [])

  async function pagar(s) {
    setMsg(null)
    const { error } = await supabase.rpc('registrar_pago_cuota', { p_socio: s.id })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: 'Pago registrado para ' + s.nombre + '.' })
    recargar()
  }

  return (
    <div className="card">
      <h3>Cuotas mensuales{monto != null ? ' (' + pesos(monto) + ')' : ''}</h3>
      <p className="mu">Cada pago corre un mes la fecha hasta la que el socio está al día y lo pasa a Miembro Gold. El monto se cambia en Puntos.</p>
      <Msg m={msg} />
      <div className="scroll">
        <table>
          <thead><tr><th>Socio</th><th>Cuota paga hasta</th><th></th></tr></thead>
          <tbody>
            {socios.map((s) => (
              <tr key={s.id}>
                <td>{etiqueta(s)}</td>
                <td>{new Date(s.cuota_pagada_hasta + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                <td><button className="btn" onClick={() => pagar(s)}>Registrar pago</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Ajustes({ socios, recargar }) {
  const [a, setA] = useState({ socio: '', puntos: '', motivo: '' })
  const [r, setR] = useState({ socio: '', rol: 'personal' })
  const [msgA, setMsgA] = useState(null)
  const [msgR, setMsgR] = useState(null)

  async function ajustar(e) {
    e.preventDefault()
    setMsgA(null)
    const { data, error } = await supabase.rpc('ajustar_puntos', {
      p_socio: a.socio, p_puntos: Number(a.puntos), p_motivo: a.motivo,
    })
    if (error) return setMsgA({ tipo: 'error', texto: error.message })
    setMsgA({ tipo: 'ok', texto: 'Ajuste hecho. Saldo total del socio: ' + fmt(data) + ' puntos.' })
    setA({ socio: '', puntos: '', motivo: '' })
  }

  async function cambiarRol(e) {
    e.preventDefault()
    setMsgR(null)
    const { error } = await supabase.rpc('cambiar_rol', { p_socio: r.socio, p_rol: r.rol })
    if (error) return setMsgR({ tipo: 'error', texto: error.message })
    setMsgR({ tipo: 'ok', texto: 'Rol actualizado.' })
    recargar()
  }

  return (
    <>
      <form className="card" onSubmit={ajustar}>
        <h3>Ajustar puntos</h3>
        <p className="mu">Usá un número positivo para sumar y uno negativo para restar.</p>
        <label htmlFor="a-socio">Socio</label>
        <select id="a-socio" value={a.socio} onChange={(e) => setA({ ...a, socio: e.target.value })} required>
          <option value="">Elegí un socio</option>
          {socios.map((s) => <option key={s.id} value={s.id}>{etiqueta(s)}</option>)}
        </select>
        <label htmlFor="a-puntos">Puntos</label>
        <input id="a-puntos" type="number" step="0.25" value={a.puntos} onChange={(e) => setA({ ...a, puntos: e.target.value })} required />
        <label htmlFor="a-motivo">Motivo</label>
        <input id="a-motivo" value={a.motivo} onChange={(e) => setA({ ...a, motivo: e.target.value })} required />
        <button className="btn pri" style={{ marginTop: 16 }}>Aplicar ajuste</button>
        <Msg m={msgA} />
      </form>

      <form className="card" onSubmit={cambiarRol}>
        <h3>Cambiar rol de un usuario</h3>
        <label htmlFor="r-socio">Usuario</label>
        <select id="r-socio" value={r.socio} onChange={(e) => setR({ ...r, socio: e.target.value })} required>
          <option value="">Elegí un usuario</option>
          {socios.map((s) => <option key={s.id} value={s.id}>{etiqueta(s)} ({s.rol})</option>)}
        </select>
        <label htmlFor="r-rol">Nuevo rol</label>
        <select id="r-rol" value={r.rol} onChange={(e) => setR({ ...r, rol: e.target.value })}>
          <option value="socio">Socio</option>
          <option value="personal">Personal del local</option>
          <option value="productor">Productor</option>
          <option value="admin">Administrador</option>
        </select>
        <button className="btn pri" style={{ marginTop: 16 }}>Cambiar rol</button>
        <Msg m={msgR} />
      </form>
    </>
  )
}

function Premios() {
  const [lista, setLista] = useState([])
  const [nuevo, setNuevo] = useState({ nombre: '', categoria: CATS[0], puntos_costo: '' })
  const [msg, setMsg] = useState(null)

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('recompensas').select('*').order('categoria').order('puntos_costo')
    setLista(data || [])
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const editar = (id, campo, valor) =>
    setLista((l) => l.map((r) => (r.id === id ? { ...r, [campo]: valor } : r)))

  async function guardar(r) {
    setMsg(null)
    const { error } = await supabase.from('recompensas')
      .update({ nombre: r.nombre, categoria: r.categoria, puntos_costo: Number(r.puntos_costo), activa: r.activa })
      .eq('id', r.id)
    setMsg(error ? { tipo: 'error', texto: error.message } : { tipo: 'ok', texto: 'Guardado: ' + r.nombre })
  }

  async function agregar(e) {
    e.preventDefault()
    setMsg(null)
    const { error } = await supabase.from('recompensas')
      .insert({ nombre: nuevo.nombre, categoria: nuevo.categoria, puntos_costo: Number(nuevo.puntos_costo) })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: 'Premio agregado: ' + nuevo.nombre })
    setNuevo({ nombre: '', categoria: CATS[0], puntos_costo: '' })
    cargar()
  }

  return (
    <>
      <form className="card" onSubmit={agregar}>
        <h3>Agregar premio</h3>
        <div className="filtros">
          <div>
            <label htmlFor="n-nombre">Nombre</label>
            <input id="n-nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} required />
          </div>
          <div>
            <label htmlFor="n-cat">Categoría</label>
            <select id="n-cat" value={nuevo.categoria} onChange={(e) => setNuevo({ ...nuevo, categoria: e.target.value })}>
              {CATS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="n-pts">Puntos</label>
            <input id="n-pts" type="number" min="0.25" step="0.25" value={nuevo.puntos_costo} onChange={(e) => setNuevo({ ...nuevo, puntos_costo: e.target.value })} required />
          </div>
        </div>
        <button className="btn pri" style={{ marginTop: 16 }}>Agregar premio</button>
      </form>
      <Msg m={msg} />

      <h2>Todos los premios</h2>
      {lista.map((r) => (
        <div key={r.id} className="card" style={{ opacity: r.activa ? 1 : 0.6 }}>
          <div className="filtros">
            <input aria-label="Nombre" value={r.nombre} onChange={(e) => editar(r.id, 'nombre', e.target.value)} />
            <select aria-label="Categoría" value={r.categoria} onChange={(e) => editar(r.id, 'categoria', e.target.value)}>
              {CATS.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input aria-label="Puntos" type="number" min="0.25" step="0.25" value={r.puntos_costo} onChange={(e) => editar(r.id, 'puntos_costo', e.target.value)} />
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className={'chip' + (r.activa ? ' on' : '')} onClick={() => editar(r.id, 'activa', !r.activa)}>
              {r.activa ? 'Visible para los socios' : 'Oculto'}
            </button>
            <button type="button" className="btn pri" onClick={() => guardar(r)}>Guardar cambios</button>
          </div>
        </div>
      ))}
    </>
  )
}

function cuotaPill(s) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const vencida = hoy > new Date(s.cuota_pagada_hasta + 'T00:00:00')
  if (s.meses_impagos_aplicados >= 2) return ['bad', 'Descuento 100%']
  if (s.meses_impagos_aplicados === 1) return ['bad', 'Descuento 50%']
  return vencida ? ['warn', 'Vencida'] : ['ok', 'Al día']
}

const ESTADO_PEDIDO = {
  pendiente: 'Pendiente', aceptado: 'En proceso', confirmado: 'Entregado', no_entregado: 'No entregado',
  rechazado: 'Rechazado', vencido: 'Sin respuesta', cancelado: 'Cancelado',
}

function HistorialSocio({ socio }) {
  const [filas, setFilas] = useState(null)
  const [msg, setMsg] = useState(null)
  useEffect(() => {
    supabase.rpc('historial_socio', { p_socio: socio.id }).then(({ data, error }) => {
      if (error) return setMsg({ tipo: 'error', texto: error.message })
      setFilas(data || [])
    })
  }, [socio.id])

  return (
    <div className="card" style={{ borderColor: 'var(--am)' }}>
      <h3>Historial de {etiqueta(socio)}</h3>
      <Msg m={msg} />
      {filas === null && !msg && <p className="mu">Cargando...</p>}
      {filas && filas.length === 0 && <p className="mu">Este socio todavía no tiene movimientos.</p>}
      {(filas || []).map((f, i) => (
        <div key={i} className="card row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>{f.titulo}</b>{f.estado && <span className={'pill ' + (f.estado === 'confirmado' ? 'ok' : f.estado === 'pendiente' || f.estado === 'aceptado' ? 'warn' : 'bad')} style={{ marginLeft: 8 }}>{ESTADO_PEDIDO[f.estado] || f.estado}</span>}
            <p className="mu">{fechaHora(f.fecha)}</p>
            {f.detalle && <p className="mu">{f.detalle}</p>}
          </div>
          <span className="pts">
            {f.pesos != null && pesos(f.pesos)}
            {f.pesos != null && f.puntos != null && ' · '}
            {f.puntos != null && ((f.tipo === 'compra' ? '' : f.puntos > 0 ? '+' : '') + fmt(f.puntos) + ' pts')}
          </span>
        </div>
      ))}
    </div>
  )
}

function Socios() {
  const [lista, setLista] = useState([])
  const [orden, setOrden] = useState('acumulado')
  const [msg, setMsg] = useState(null)
  const [version, setVersion] = useState(0)
  const [historial, setHistorial] = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.rpc('resumen_socios'),
      supabase.from('perfiles').select('id, apellido'),
    ]).then(([r, a]) => {
      if (r.error) return setMsg({ tipo: 'error', texto: r.error.message })
      const ap = Object.fromEntries((a.data || []).map((x) => [x.id, x.apellido]))
      setLista((r.data || []).map((s) => ({ ...s, apellido: ap[s.id] || '' })))
    })
  }, [version])

  const ordenada = [...lista].sort((a, b) =>
    orden === 'numero' ? a.numero_socio - b.numero_socio : Number(b[orden]) - Number(a[orden]))
  const elegido = lista.find((s) => s.id === historial)

  return (
    <div className="card">
      <h3>Socios</h3>
      <p className="mu">Puntos adquiridos = todos los puntos que el socio sumó por recargas. Sirve para ver quién es el más fiel.</p>
      <p className="mu">La categoría es automática: Gold mientras la cuota esté al día. Si se vence, vuelve a Miembro.</p>
      <div className="chips">
        {[['acumulado', 'Más fieles'], ['saldo', 'Más puntos actuales'], ['numero', 'Número de socio']].map(([id, t]) => (
          <button key={id} className={'chip' + (orden === id ? ' on' : '')} onClick={() => setOrden(id)}>{t}</button>
        ))}
      </div>
      <Msg m={msg} />
      {elegido && <HistorialSocio socio={elegido} />}
      <div className="scroll">
        <table>
          <thead><tr><th>#</th><th>Socio</th><th>Puntos actuales</th><th>Puntos adquiridos</th><th>Cuota</th><th>Categoría</th><th></th></tr></thead>
          <tbody>
            {ordenada.map((s, i) => {
              const [clase, texto] = cuotaPill(s)
              return (
                <tr key={s.id}>
                  <td>{i + 1}</td>
                  <td>{etiqueta(s)}{s.apodo && <span className="mu"> ({s.apodo})</span>}</td>
                  <td>{fmt(s.saldo)}</td>
                  <td>{fmt(s.acumulado)}</td>
                  <td><span className={'pill ' + clase}>{texto}</span></td>
                  <td><Categoria valor={s.categoria} /></td>
                  <td><button type="button" className="btn" onClick={() => { setHistorial(historial === s.id ? null : s.id); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>{historial === s.id ? 'Ocultar' : 'Historial'}</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Marca({ marca, onGuardado }) {
  const [f, setF] = useState({
    nombre_app: marca.nombre_app, descripcion: marca.descripcion,
    whatsapp: marca.whatsapp || '', aviso_envio: marca.aviso_envio || '',
    cerveceria_club: marca.cerveceria_club || 'Club Cervecero',
  })
  const [msg, setMsg] = useState(null)
  const [subiendo, setSubiendo] = useState('')

  async function actualizar(cambios) {
    const { error } = await supabase.from('configuracion')
      .update({ ...cambios, actualizado_en: new Date().toISOString() }).eq('id', 1)
    if (error) { setMsg({ tipo: 'error', texto: error.message }); return false }
    onGuardado()
    return true
  }

  async function guardarTextos(e) {
    e.preventDefault()
    setMsg(null)
    const wa = f.whatsapp.replace(/\D/g, '')
    if (await actualizar({ nombre_app: f.nombre_app.trim(), descripcion: f.descripcion.trim(), whatsapp: wa || null, aviso_envio: f.aviso_envio.trim(), cerveceria_club: f.cerveceria_club.trim() || 'Club Cervecero' }))
      setMsg({ tipo: 'ok', texto: 'Datos guardados.' })
  }

  async function subir(campo, archivo) {
    if (!archivo) return
    setMsg(null)
    if (archivo.size > 1024 * 1024) return setMsg({ tipo: 'error', texto: 'La imagen pesa más de 1 MB. Probá con una más liviana.' })
    setSubiendo(campo)
    const ext = (archivo.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '')
    const ruta = campo + '-' + Date.now() + '.' + ext
    const { error } = await supabase.storage.from('logos').upload(ruta, archivo, { contentType: archivo.type })
    if (error) { setSubiendo(''); return setMsg({ tipo: 'error', texto: error.message }) }
    const { data } = supabase.storage.from('logos').getPublicUrl(ruta)
    if (await actualizar({ [campo]: data.publicUrl })) setMsg({ tipo: 'ok', texto: 'Logo actualizado.' })
    setSubiendo('')
  }

  const logos = [
    ['logo_login_url', 'Logo de la pantalla de ingreso'],
    ['logo_app_url', 'Logo dentro de la aplicación'],
  ]

  return (
    <>
      <form className="card" onSubmit={guardarTextos}>
        <h3>Datos del negocio</h3>
        <label htmlFor="m-nombre">Nombre de la aplicación</label>
        <input id="m-nombre" value={f.nombre_app} onChange={(e) => setF({ ...f, nombre_app: e.target.value })} required />
        <label htmlFor="m-desc">Descripción (se ve en la pantalla de ingreso)</label>
        <input id="m-desc" value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} required />
        <label htmlFor="m-cerv">Nombre de la cervecería en los productos del club</label>
        <input id="m-cerv" value={f.cerveceria_club} onChange={(e) => setF({ ...f, cerveceria_club: e.target.value })} required />
        <label htmlFor="m-wa">WhatsApp del negocio (con código de país, sin + ni espacios)</label>
        <input id="m-wa" inputMode="numeric" placeholder="5492215551234" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} />
        <label htmlFor="m-envio">Aviso de costo extra del envío (va en el mensaje de WhatsApp)</label>
        <input id="m-envio" value={f.aviso_envio} onChange={(e) => setF({ ...f, aviso_envio: e.target.value })} />
        <button className="btn pri" style={{ marginTop: 16 }}>Guardar</button>
      </form>

      {logos.map(([campo, titulo]) => (
        <div key={campo} className="card">
          <h3>{titulo}</h3>
          {marca[campo] ? <img className="logo" src={marca[campo]} alt="" style={{ maxHeight: 80, margin: '8px 0' }} /> : <p className="mu">Todavía no hay logo: se usa el ícono por defecto.</p>}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" disabled={subiendo === campo}
            onChange={(e) => { subir(campo, e.target.files[0]); e.target.value = '' }} />
          {subiendo === campo && <p className="mu">Subiendo...</p>}
          {marca[campo] && <div style={{ marginTop: 10 }}><button className="btn" onClick={() => actualizar({ [campo]: null })}>Quitar logo</button></div>}
        </div>
      ))}
      <p className="mu">Imágenes PNG, JPG, WEBP o SVG de hasta 1 MB. Con fondo transparente se ven mejor en modo oscuro.</p>
      <Msg m={msg} />
    </>
  )
}

const PAGO_TXT = { efectivo: 'Efectivo en el local', transferencia: 'Transferencia', puntos: 'Puntos' }
const pesos = (n) => '$ ' + fmt(n)

function Cobros({ onCambio, esAdmin }) {
  const [pagos, setPagos] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [msg, setMsg] = useState(null)

  const cargar = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from('pagos_informados').select('*, perfiles(numero_socio, nombre)').eq('estado', 'pendiente').order('creado_en'),
      supabase.from('pedidos').select('*, perfiles(numero_socio, nombre, apellido), pedido_items(*)').in('estado', ['pendiente', 'aceptado']).is('productor_id', null).order('creado_en'),
    ])
    setPagos(a.data || [])
    setPedidos(b.data || [])
  }, [])
  useEffect(() => { cargar() }, [cargar])

  async function resolver(promesa, ok) {
    setMsg(null)
    const { error } = await promesa
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: ok })
    await cargar()
    onCambio()
  }

  const resolverPago = (id, confirmar) =>
    resolver(supabase.rpc('resolver_pago_informado', { p_id: id, p_confirmar: confirmar }),
      confirmar ? 'Pago confirmado: la cuota del socio se actualizó.' : 'Aviso de pago rechazado.')

  const MENSAJES = {
    aceptar: 'Pedido aceptado: el socio ya ve que está en proceso.',
    entregar: 'Pedido entregado: se cobró, se descontaron los puntos y cuenta en la facturación.',
    no_entregado: 'Marcado como no entregado: se devolvió el stock y se liberaron los puntos.',
    cancelar: 'Pedido cancelado: stock devuelto.',
  }
  const resolverPedido = (id, accion) => {
    if (accion === 'cancelar' && !window.confirm('¿Cancelar el pedido? Se devuelven el stock y, si pagó con puntos, los puntos.')) return
    if (accion === 'no_entregado' && !window.confirm('¿Marcar el pedido como no entregado? No se cobra ni cuenta en la facturación.')) return
    return resolver(supabase.rpc('resolver_pedido', { p_id: id, p_accion: accion }), MENSAJES[accion])
  }

  const porAceptar = pedidos.filter((p) => p.estado === 'pendiente')
  const enProceso = pedidos.filter((p) => p.estado === 'aceptado')
  const quien = (p) => 'Socio N.º ' + String(p.perfiles.numero_socio).padStart(4, '0') + ' · ' + ([p.perfiles.nombre, p.perfiles.apellido].filter(Boolean).join(' ') || 'Sin nombre')

  return (
    <>
      {esAdmin && <TiendaControl titulo="Tienda del club" propia={false} />}
      <h2 style={{ marginTop: 6 }}>Pagos de cuota informados</h2>
      {pagos.length === 0 && <p className="mu">No hay avisos de pago pendientes.</p>}
      {pagos.map((p) => (
        <div key={p.id} className="card">
          <b>{quien(p)}</b>
          <p className="mu">Avisó el {fechaHora(p.creado_en)}. Confirmá solo si la plata ya llegó.</p>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" onClick={() => resolverPago(p.id, false)}>Rechazar</button>
            <button className="btn pri" onClick={() => resolverPago(p.id, true)}>Confirmar pago</button>
          </div>
        </div>
      ))}

      <h2>Pedidos por aceptar</h2>
      {porAceptar.length === 0 && <p className="mu">No hay pedidos pendientes.</p>}
      {porAceptar.map((p) => (
        <div key={p.id} className="card">
          <div className="row"><b>Pedido N.º {p.numero}</b><span className="mu">{fechaHora(p.creado_en)}</span></div>
          <p>{quien(p)}</p>
          {p.pedido_items.map((i) => <p key={i.id}>{i.cantidad} × {i.nombre}{i.formato ? ' (' + i.formato + ')' : ''}</p>)}
          <p className="pts" style={{ marginTop: 6 }}>{p.pago === 'puntos' ? fmt(p.total_puntos) + ' pts (reservados hasta la entrega)' : pesos(p.total_pesos)}</p>
          <p className="mu">Pago: {PAGO_TXT[p.pago]} · {p.entrega === 'envio' ? 'Envío a ' + p.direccion : 'Retiro en el local'}</p>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" onClick={() => resolverPedido(p.id, 'cancelar')}>Cancelar pedido</button>
            <button className="btn pri" onClick={() => resolverPedido(p.id, 'aceptar')}>Aceptar pedido</button>
          </div>
        </div>
      ))}

      <h2>Pedidos en proceso</h2>
      {enProceso.length === 0 && <p className="mu">No hay pedidos en proceso.</p>}
      {enProceso.map((p) => (
        <div key={p.id} className="card">
          <div className="row"><b>Pedido N.º {p.numero}</b><span className="pill warn">{p.entrega === 'envio' ? 'Envío en proceso' : 'Listo para retirar'}</span></div>
          <p>{quien(p)}</p>
          {p.pedido_items.map((i) => <p key={i.id}>{i.cantidad} × {i.nombre}{i.formato ? ' (' + i.formato + ')' : ''}</p>)}
          <p className="pts" style={{ marginTop: 6 }}>{p.pago === 'puntos' ? fmt(p.total_puntos) + ' pts (reservados hasta la entrega)' : pesos(p.total_pesos)}</p>
          <p className="mu">Pago: {PAGO_TXT[p.pago]} · {p.entrega === 'envio' ? 'Envío a ' + p.direccion : 'Retiro en el local'}. Al marcar entregado se cobra, se descuentan los puntos y cuenta en la facturación.</p>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" onClick={() => resolverPedido(p.id, 'no_entregado')}>No entregado</button>
            <button className="btn pri" onClick={() => resolverPedido(p.id, 'entregar')}>Entregado</button>
          </div>
        </div>
      ))}
      <Msg m={msg} />
    </>
  )
}

export function CamposProducto({ r, set, secciones, id, onImagen, conCerveceria }) {
  return (
    <div className="filtros">
      <div><label htmlFor={id + '-n'}>Nombre</label><input id={id + '-n'} value={r.nombre} onChange={(e) => set('nombre', e.target.value)} required /></div>
      {conCerveceria && <div><label htmlFor={id + '-cv'}>Cervecería</label><input id={id + '-cv'} value={r.cerveceria ?? ''} onChange={(e) => set('cerveceria', e.target.value)} required /></div>}
      <div>
        <label htmlFor={id + '-s'}>Sección</label>
        <select id={id + '-s'} value={r.seccion} onChange={(e) => set('seccion', e.target.value)}>
          {secciones.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
      </div>
      <div><label htmlFor={id + '-f'}>Formato</label><input id={id + '-f'} placeholder="1 litro" value={r.formato ?? ''} onChange={(e) => set('formato', e.target.value)} /></div>
      <div><label htmlFor={id + '-p'}>Precio ($)</label><input id={id + '-p'} type="number" min="0" step="1" value={r.precio_pesos} onChange={(e) => set('precio_pesos', e.target.value)} required /></div>
      <div>
        <label>Precio en puntos</label>
        <p className="mu">{r.precio_puntos != null ? fmt(r.precio_puntos) + ' pts (automático)' : 'Automático: 90% del precio, con el valor del punto'}</p>
      </div>
      <div><label htmlFor={id + '-st'}>Stock (unidades)</label><input id={id + '-st'} type="number" min="0" step="1" value={r.stock} onChange={(e) => set('stock', e.target.value)} required /></div>
      <div style={{ gridColumn: '1 / -1' }}>
        <label htmlFor={id + '-i'}>Imagen (opcional, se reduce sola para que sea liviana)</label>
        {r.imagen_url && <img className="prod-img" src={r.imagen_url} alt="Imagen actual del producto" style={{ margin: '6px 0' }} />}
        <input id={id + '-i'} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { onImagen(e.target.files[0]); e.target.value = '' }} />
        {r.imagen_url && <div style={{ marginTop: 8 }}><button type="button" className="btn" onClick={() => set('imagen_url', null)}>Quitar imagen</button></div>}
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <label htmlFor={id + '-d'}>Descripción (opcional, por ejemplo qué incluye el combo)</label>
        <input id={id + '-d'} value={r.descripcion ?? ''} onChange={(e) => set('descripcion', e.target.value)} />
      </div>
    </div>
  )
}

function TiendaAdmin() {
  const vacio = { seccion: 'cervezas', nombre: '', formato: '', descripcion: '', precio_pesos: '', stock: '', imagen_url: null }
  const [secciones, setSecciones] = useState([])
  const [lista, setLista] = useState([])
  const [nuevo, setNuevo] = useState(vacio)
  const [msg, setMsg] = useState(null)

  const cargar = useCallback(async () => {
    const [s, p] = await Promise.all([
      supabase.from('tienda_secciones').select('*').order('orden'),
      supabase.from('tienda_productos').select('*').is('productor_id', null).order('seccion').order('nombre'),
    ])
    setSecciones(s.data || [])
    setLista(p.data || [])
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const editar = (id, campo, valor) => setLista((l) => l.map((r) => (r.id === id ? { ...r, [campo]: valor } : r)))
  const datos = (r) => ({
    seccion: r.seccion, nombre: r.nombre.trim(),
    formato: r.formato && r.formato.trim() ? r.formato.trim() : null,
    descripcion: r.descripcion && r.descripcion.trim() ? r.descripcion.trim() : null,
    precio_pesos: Number(r.precio_pesos),
    stock: Math.max(0, Math.floor(Number(r.stock || 0))),
    imagen_url: r.imagen_url || null,
  })

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

  async function alternarSeccion(s) {
    setMsg(null)
    const { error } = await supabase.from('tienda_secciones').update({ visible: !s.visible }).eq('id', s.id)
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    cargar()
  }

  async function guardar(r) {
    setMsg(null)
    const { error } = await supabase.from('tienda_productos').update({ ...datos(r), activo: r.activo }).eq('id', r.id)
    setMsg(error ? { tipo: 'error', texto: error.message } : { tipo: 'ok', texto: 'Guardado: ' + r.nombre })
  }

  async function agregar(e) {
    e.preventDefault()
    setMsg(null)
    const { error } = await supabase.from('tienda_productos').insert(datos(nuevo))
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: 'Producto agregado: ' + nuevo.nombre })
    setNuevo(vacio)
    cargar()
  }

  return (
    <>
      <div className="card">
        <h3>Secciones de la tienda</h3>
        <p className="mu">Elegí cuáles ven los socios.</p>
        <div className="chips">
          {secciones.map((s) => (
            <button key={s.id} type="button" className={'chip' + (s.visible ? ' on' : '')} onClick={() => alternarSeccion(s)}>
              {s.nombre}: {s.visible ? 'visible' : 'oculta'}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Más vendidos</h3>
        <MasVendidos />
      </div>

      <form className="card" onSubmit={agregar}>
        <h3>Agregar producto</h3>
        <CamposProducto r={nuevo} set={(c, v) => setNuevo({ ...nuevo, [c]: v })} secciones={secciones} id="nuevo"
          onImagen={(f) => cambiarImagen(f, (url) => setNuevo((n) => ({ ...n, imagen_url: url })))} />
        <button className="btn pri" style={{ marginTop: 16 }}>Agregar producto</button>
      </form>
      <Msg m={msg} />

      <h2>Productos</h2>
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

const mesLargo = (a, m) => new Date(Date.UTC(a, m, 15)).toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const sumaPesos = (lista) => lista.reduce((acc, p) => acc + Number(p.total_pesos), 0)

function Facturacion() {
  // Argentina es UTC-3 todo el año: el mes arranca a las 03:00 UTC del dia 1.
  const hoy = new Date(Date.now() - 3 * 3600 * 1000)
  const actual = { a: hoy.getUTCFullYear(), m: hoy.getUTCMonth() }
  const [per, setPer] = useState(actual)
  const [pedidos, setPedidos] = useState([])
  const [cuotas, setCuotas] = useState(null)
  const [membresias, setMembresias] = useState([])
  const [filtro, setFiltro] = useState('todos')
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    let vigente = true
    const desde = new Date(Date.UTC(per.a, per.m, 1, 3)).toISOString()
    const hasta = new Date(Date.UTC(per.a, per.m + 1, 1, 3)).toISOString()
    setCargando(true)
    setMsg(null)
    Promise.all([
      supabase.from('pedidos').select('*, perfiles(numero_socio, nombre), pedido_items(*)')
        .eq('estado', 'confirmado').is('productor_id', null).gte('resuelto_en', desde).lt('resuelto_en', hasta)
        .order('resuelto_en', { ascending: false }),
      supabase.from('pagos_cuota').select('monto').gte('pagado_en', desde).lt('pagado_en', hasta),
      supabase.from('rendiciones_productor').select('resultado')
        .eq('estado', 'pagado').gte('pagado_en', desde).lt('pagado_en', hasta),
    ]).then(([a, b, c]) => {
      if (!vigente) return
      if (a.error) setMsg({ tipo: 'error', texto: a.error.message })
      setPedidos(a.data || [])
      setCuotas(b.error ? null : b.data || [])
      setMembresias(c.error ? [] : c.data || [])
      setCargando(false)
    })
    return () => { vigente = false }
  }, [per])

  const mover = (d) => setPer(({ a, m }) => {
    const n = new Date(Date.UTC(a, m + d, 1))
    return { a: n.getUTCFullYear(), m: n.getUTCMonth() }
  })
  const esActual = per.a === actual.a && per.m === actual.m

  const dinero = pedidos.filter((p) => p.pago !== 'puntos')
  const efectivo = dinero.filter((p) => p.pago === 'efectivo')
  const transf = dinero.filter((p) => p.pago === 'transferencia')
  const conPuntos = pedidos.filter((p) => p.pago === 'puntos')
  const totalCuotas = cuotas ? cuotas.reduce((acc, c) => acc + Number(c.monto), 0) : 0
  const lista = pedidos.filter((p) => filtro === 'todos' || p.pago === filtro)
  const totalMem = membresias.reduce((acc, m) => acc + Math.max(Number(m.resultado), 0), 0)
  const pagadoProd = membresias.reduce((acc, m) => acc + Math.max(-Number(m.resultado), 0), 0)
  const totalMes = sumaPesos(dinero) + totalCuotas + totalMem

  return (
    <>
      <div className="card">
        <div className="row">
          <button type="button" className="btn" aria-label="Mes anterior" onClick={() => mover(-1)}>◀</button>
          <h3 style={{ textTransform: 'capitalize' }}>{mesLargo(per.a, per.m)}</h3>
          <button type="button" className="btn" aria-label="Mes siguiente" disabled={esActual} onClick={() => mover(1)}>▶</button>
        </div>
        <p className="mu" style={{ marginTop: 12 }}>Total facturado del mes</p>
        <p className="pts" style={{ fontSize: 32 }}>{cargando ? '...' : pesos(totalMes)}</p>
        <p className="mu">
          Tienda {pesos(sumaPesos(dinero))} · Cuotas de socios {pesos(totalCuotas)} ({cuotas ? cuotas.length : 0} pagos) · Rendiciones de productores {pesos(totalMem)}
        </p>
        <p className="mu" style={{ marginTop: 8 }}>Tienda: efectivo {pesos(sumaPesos(efectivo))} ({efectivo.length}) · transferencia {pesos(sumaPesos(transf))} ({transf.length})</p>
        <p className="mu">Pagados con puntos: {conPuntos.length} pedidos ({fmt(conPuntos.reduce((acc, p) => acc + Number(p.total_puntos), 0))} puntos). No suman a la facturación.</p>
        {pagadoProd > 0 && <p className="mu">Pagado a productores en rendiciones, aparte: {pesos(pagadoProd)} (no se resta del total).</p>}
        <p className="mu" style={{ marginTop: 8 }}>Cada pedido se cuenta en el mes en que se confirma. No incluye el costo de envío, que se acuerda por WhatsApp.</p>
      </div>
      <Msg m={msg} />

      <h2>Detalle de las compras</h2>
      <div className="chips">
        {[['todos', 'Todas'], ['efectivo', 'Efectivo'], ['transferencia', 'Transferencia'], ['puntos', 'Puntos']].map(([id, t]) => (
          <button key={id} type="button" className={'chip' + (filtro === id ? ' on' : '')} onClick={() => setFiltro(id)}>{t}</button>
        ))}
      </div>
      {!cargando && lista.length === 0 && <p className="mu">No hay compras confirmadas para mostrar en este mes.</p>}
      {lista.map((p) => (
        <div key={p.id} className="card">
          <div className="row"><b>Pedido N.º {p.numero}</b><span className="mu">{fechaHora(p.resuelto_en)}</span></div>
          <p>Socio N.º {String(p.perfiles.numero_socio).padStart(4, '0')} · {p.perfiles.nombre || 'Sin nombre'}</p>
          {p.pedido_items.map((i) => (
            <div key={i.id} className="row" style={{ marginTop: 4 }}>
              <span>{i.cantidad} × {i.nombre}{i.formato ? ' (' + i.formato + ')' : ''}</span>
              <span className="mu">{p.pago === 'puntos' && i.precio_puntos != null ? fmt(i.precio_puntos * i.cantidad) + ' pts' : pesos(i.precio_pesos * i.cantidad)}</span>
            </div>
          ))}
          <div className="row" style={{ marginTop: 8 }}>
            <span className="mu">{PAGO_TXT[p.pago]} · {p.entrega === 'envio' ? 'Envío a ' + p.direccion : 'Retiro en el local'}</span>
            <span className="pts">{p.pago === 'puntos' ? fmt(p.total_puntos) + ' pts' : pesos(p.total_pesos)}</span>
          </div>
        </div>
      ))}
    </>
  )
}

// Fecha ISO <-> campo datetime-local (Argentina es UTC-3 todo el año).
const aCampo = (iso) => new Date(new Date(iso).getTime() - 3 * 3600 * 1000).toISOString().slice(0, 16)
const deCampo = (v) => new Date(v + ':00-03:00').toISOString()

function EventosAdmin() {
  const [tab, setTab] = useState('club')
  return (
    <>
      <div className="chips">
        <button type="button" className={'chip' + (tab === 'club' ? ' on' : '')} onClick={() => setTab('club')}>Eventos del club</button>
        <button type="button" className={'chip' + (tab === 'cerveceros' ? ' on' : '')} onClick={() => setTab('cerveceros')}>Eventos de Cerveceros</button>
      </div>
      {tab === 'club' ? <EventosClub /> : <EventosCerveceros />}
    </>
  )
}

function EventosCerveceros() {
  const vacio = { titulo: '', fecha: '', lugar: '', descripcion: '' }
  const [lista, setLista] = useState([])
  const [nuevo, setNuevo] = useState(vacio)
  const [msg, setMsg] = useState(null)

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('eventos_productores').select('*').order('fecha', { ascending: false })
    setLista((data || []).map((e) => ({ ...e, fecha: aCampo(e.fecha), lugar: e.lugar ?? '', descripcion: e.descripcion ?? '' })))
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const editar = (id, c, v) => setLista((l) => l.map((e) => (e.id === id ? { ...e, [c]: v } : e)))
  const datos = (e) => ({
    titulo: e.titulo.trim(), fecha: deCampo(e.fecha),
    lugar: e.lugar.trim() || null, descripcion: e.descripcion.trim() || null,
  })

  async function guardar(e) {
    setMsg(null)
    const { error } = await supabase.from('eventos_productores').update(datos(e)).eq('id', e.id)
    setMsg(error ? { tipo: 'error', texto: error.message } : { tipo: 'ok', texto: 'Guardado: ' + e.titulo })
  }
  async function agregar(ev) {
    ev.preventDefault()
    setMsg(null)
    const { error } = await supabase.from('eventos_productores').insert(datos(nuevo))
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: 'Evento agregado: ' + nuevo.titulo })
    setNuevo(vacio)
    cargar()
  }
  async function borrar(e) {
    if (!window.confirm('¿Eliminar "' + e.titulo + '"?')) return
    setMsg(null)
    const { error } = await supabase.from('eventos_productores').delete().eq('id', e.id)
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    cargar()
  }

  const campos = (e, set, id) => (
    <div className="filtros">
      <div><label htmlFor={id + '-t'}>Título</label><input id={id + '-t'} value={e.titulo} onChange={(x) => set('titulo', x.target.value)} required /></div>
      <div><label htmlFor={id + '-f'}>Fecha y hora</label><input id={id + '-f'} type="datetime-local" value={e.fecha} onChange={(x) => set('fecha', x.target.value)} required /></div>
      <div><label htmlFor={id + '-l'}>Lugar</label><input id={id + '-l'} value={e.lugar} onChange={(x) => set('lugar', x.target.value)} /></div>
      <div style={{ gridColumn: '1 / -1' }}><label htmlFor={id + '-d'}>Descripción (opcional)</label><input id={id + '-d'} value={e.descripcion} onChange={(x) => set('descripcion', x.target.value)} /></div>
    </div>
  )

  return (
    <>
      <p className="mu">Solo los ven los productores, en su pantalla de Inicio. Desaparecen solos cuando pasa la fecha.</p>
      <form className="card" onSubmit={agregar}>
        <h3>Agregar evento de Cerveceros</h3>
        {campos(nuevo, (c, v) => setNuevo({ ...nuevo, [c]: v }), 'nuevo-ec')}
        <button className="btn pri" style={{ marginTop: 16 }}>Agregar evento</button>
      </form>
      <Msg m={msg} />
      <h2>Eventos de Cerveceros</h2>
      {lista.length === 0 && <p className="mu">Todavía no cargaste eventos.</p>}
      {lista.map((e) => (
        <div key={e.id} className="card">
          {campos(e, (c, v) => editar(e.id, c, v), 'ec-' + e.id)}
          <div className="row" style={{ marginTop: 10 }}>
            <button type="button" className="btn" onClick={() => borrar(e)}>Eliminar</button>
            <button type="button" className="btn pri" onClick={() => guardar(e)}>Guardar cambios</button>
          </div>
        </div>
      ))}
    </>
  )
}

function EventosClub() {
  const vacio = { titulo: '', descripcion: '', fecha: '', cupos: '' }
  const [abierto, setAbierto] = useState(null)
  const [anotados, setAnotados] = useState({})
  const [lista, setLista] = useState([])
  const [nuevo, setNuevo] = useState(vacio)
  const [msg, setMsg] = useState(null)

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('eventos').select('*, inscripciones_eventos(count)').order('fecha', { ascending: false })
    setLista((data || []).map((e) => ({
      ...e, fecha: aCampo(e.fecha), cupos: e.cupos ?? '', descripcion: e.descripcion ?? '',
      anotados: e.inscripciones_eventos && e.inscripciones_eventos[0] ? e.inscripciones_eventos[0].count : 0,
    })))
  }, [])
  useEffect(() => { cargar() }, [cargar])

  async function verAnotados(e) {
    if (abierto === e.id) return setAbierto(null)
    setMsg(null)
    const { data, error } = await supabase.rpc('anotados_evento', { p_evento: e.id })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setAnotados((m) => ({ ...m, [e.id]: data || [] }))
    setAbierto(e.id)
  }
  const copiar = (filas) =>
    navigator.clipboard.writeText(filas.map((a) => a.email).join(', '))
      .then(() => setMsg({ tipo: 'ok', texto: 'Correos copiados.' }), () => setMsg({ tipo: 'error', texto: 'No se pudo copiar.' }))

  const editar = (id, c, v) => setLista((l) => l.map((e) => (e.id === id ? { ...e, [c]: v } : e)))
  const datos = (e) => ({
    titulo: e.titulo.trim(), descripcion: e.descripcion.trim() || null, fecha: deCampo(e.fecha),
    cupos: e.cupos === '' ? null : Math.max(0, Math.floor(Number(e.cupos))),
  })

  async function guardar(e) {
    setMsg(null)
    const { error } = await supabase.from('eventos').update(datos(e)).eq('id', e.id)
    setMsg(error ? { tipo: 'error', texto: error.message } : { tipo: 'ok', texto: 'Guardado: ' + e.titulo })
  }
  async function agregar(ev) {
    ev.preventDefault()
    setMsg(null)
    const { error } = await supabase.from('eventos').insert(datos(nuevo))
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: 'Evento agregado: ' + nuevo.titulo })
    setNuevo(vacio)
    cargar()
  }
  async function borrar(e) {
    if (!window.confirm('¿Eliminar "' + e.titulo + '"? También se borran las inscripciones.')) return
    setMsg(null)
    const { error } = await supabase.from('eventos').delete().eq('id', e.id)
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    cargar()
  }

  const campos = (e, set, id) => (
    <div className="filtros">
      <div><label htmlFor={id + '-t'}>Título</label><input id={id + '-t'} value={e.titulo} onChange={(x) => set('titulo', x.target.value)} required /></div>
      <div><label htmlFor={id + '-f'}>Fecha y hora</label><input id={id + '-f'} type="datetime-local" value={e.fecha} onChange={(x) => set('fecha', x.target.value)} required /></div>
      <div><label htmlFor={id + '-c'}>Cupos (vacío = sin límite)</label><input id={id + '-c'} type="number" min="0" step="1" value={e.cupos} onChange={(x) => set('cupos', x.target.value)} /></div>
      <div style={{ gridColumn: '1 / -1' }}><label htmlFor={id + '-d'}>Descripción (opcional)</label><input id={id + '-d'} value={e.descripcion} onChange={(x) => set('descripcion', x.target.value)} /></div>
    </div>
  )

  return (
    <>
      <form className="card" onSubmit={agregar}>
        <h3>Agregar evento</h3>
        {campos(nuevo, (c, v) => setNuevo({ ...nuevo, [c]: v }), 'nuevo-ev')}
        <button className="btn pri" style={{ marginTop: 16 }}>Agregar evento</button>
      </form>
      <Msg m={msg} />
      <h2>Eventos</h2>
      {lista.length === 0 && <p className="mu">Todavía no cargaste eventos.</p>}
      {lista.map((e) => (
        <div key={e.id} className="card">
          {campos(e, (c, v) => editar(e.id, c, v), e.id)}
          <div className="row" style={{ marginTop: 8 }}>
            <span className="mu">Anotados: {e.anotados}</span>
            <button type="button" className="btn" onClick={() => verAnotados(e)}>{abierto === e.id ? 'Ocultar anotados' : 'Ver anotados'}</button>
          </div>
          {abierto === e.id && (
            <div style={{ marginTop: 8 }}>
              {(anotados[e.id] || []).length === 0 && <p className="mu">Todavía no se anotó nadie.</p>}
              {(anotados[e.id] || []).length > 0 && (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <table>
                      <thead><tr><th>Nombre</th><th>Apellido</th><th>Correo</th></tr></thead>
                      <tbody>
                        {anotados[e.id].map((a, i) => <tr key={i}><td>{a.nombre}</td><td>{a.apellido}</td><td>{a.email}</td></tr>)}
                      </tbody>
                    </table>
                  </div>
                  <button type="button" className="btn" style={{ marginTop: 8 }} onClick={() => copiar(anotados[e.id])}>Copiar correos</button>
                </>
              )}
            </div>
          )}
          <div className="row" style={{ marginTop: 10 }}>
            <button type="button" className="btn" onClick={() => borrar(e)}>Eliminar</button>
            <button type="button" className="btn pri" onClick={() => guardar(e)}>Guardar cambios</button>
          </div>
        </div>
      ))}
    </>
  )
}

function NovedadesAdmin() {
  const [lista, setLista] = useState([])
  const [nueva, setNueva] = useState({ titulo: '', texto: '' })
  const [msg, setMsg] = useState(null)

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('novedades').select('*').order('creado_en', { ascending: false })
    setLista(data || [])
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const editar = (id, c, v) => setLista((l) => l.map((n) => (n.id === id ? { ...n, [c]: v } : n)))

  async function guardar(n) {
    setMsg(null)
    const { error } = await supabase.from('novedades')
      .update({ titulo: n.titulo.trim(), texto: n.texto.trim(), publicada: n.publicada }).eq('id', n.id)
    setMsg(error ? { tipo: 'error', texto: error.message } : { tipo: 'ok', texto: 'Guardado: ' + n.titulo })
  }
  async function agregar(e) {
    e.preventDefault()
    setMsg(null)
    const { error } = await supabase.from('novedades').insert({ titulo: nueva.titulo.trim(), texto: nueva.texto.trim() })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: 'Novedad publicada: ' + nueva.titulo })
    setNueva({ titulo: '', texto: '' })
    cargar()
  }
  async function borrar(n) {
    if (!window.confirm('¿Eliminar "' + n.titulo + '"?')) return
    setMsg(null)
    const { error } = await supabase.from('novedades').delete().eq('id', n.id)
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    cargar()
  }

  return (
    <>
      <form className="card" onSubmit={agregar}>
        <h3>Nueva novedad</h3>
        <label htmlFor="nv-t">Título</label>
        <input id="nv-t" value={nueva.titulo} onChange={(e) => setNueva({ ...nueva, titulo: e.target.value })} required />
        <label htmlFor="nv-x">Texto</label>
        <textarea id="nv-x" value={nueva.texto} onChange={(e) => setNueva({ ...nueva, texto: e.target.value })} />
        <button className="btn pri" style={{ marginTop: 16 }}>Publicar</button>
      </form>
      <Msg m={msg} />
      <h2>Novedades</h2>
      {lista.length === 0 && <p className="mu">Todavía no publicaste novedades.</p>}
      {lista.map((n) => (
        <div key={n.id} className="card" style={{ opacity: n.publicada ? 1 : 0.6 }}>
          <label htmlFor={n.id + '-t'}>Título</label>
          <input id={n.id + '-t'} value={n.titulo} onChange={(e) => editar(n.id, 'titulo', e.target.value)} />
          <label htmlFor={n.id + '-x'}>Texto</label>
          <textarea id={n.id + '-x'} value={n.texto} onChange={(e) => editar(n.id, 'texto', e.target.value)} />
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className={'chip' + (n.publicada ? ' on' : '')} onClick={() => editar(n.id, 'publicada', !n.publicada)}>
              {n.publicada ? 'Visible para los socios' : 'Oculta'}
            </button>
            <button type="button" className="btn" onClick={() => borrar(n)}>Eliminar</button>
            <button type="button" className="btn pri" onClick={() => guardar(n)}>Guardar cambios</button>
          </div>
        </div>
      ))}
    </>
  )
}

const GRUPOS_PUNTOS = [
  {
    titulo: 'Puntos que se suman',
    nota: 'La compra suma por cada pedido confirmado en la tienda (del club o de un productor) y por cada compra extra que carga el personal. El referido suma una vez, cuando el amigo confirma su correo.',
    campos: [
      ['bono_compra_miembro', 'Compra de un Miembro', 'Puntos que suma cada compra', 1000, 0.05],
      ['bono_compra_gold', 'Compra de un Miembro Gold', 'Puntos que suma cada compra', 1000, 0.05],
      ['bono_referido_miembro', 'Referido: invita un Miembro', 'Puntos que gana quien invita', 1000, 0.05],
      ['bono_referido_gold', 'Referido: invita un Miembro Gold', 'Puntos que gana quien invita', 1000, 0.05],
    ],
  },
  {
    titulo: 'Cuota de los socios',
    nota: 'Es una sola para todos. Al confirmar un pago se suma en Facturación con el monto de ese momento y el socio pasa a Miembro Gold hasta que se le vence la cuota.',
    campos: [['monto_cuota', 'Monto de la cuota mensual ($)', 'Pesos por mes', 10000000, 1]],
  },
  {
    titulo: 'Productores',
    nota: 'El valor del punto se guarda en cada pedido pagado con puntos: si lo cambiás, no afecta a los puntos ya acumulados. También define el precio en puntos de los productos (90% del precio en pesos). Cada día 1 se genera la rendición del mes anterior: porcentaje sobre el ingreso (pesos más puntos) menos el valor de los puntos obtenidos.',
    campos: [
      ['valor_punto', 'Valor de cada punto ($)', 'Pesos que vale un punto para el productor', 1000000, 0.01],
      ['membresia_porcentaje', 'Porcentaje pactado con productores (%)', 'Porcentaje del ingreso del mes anterior', 100, 0.1],
      ['membresia_dias_gracia', 'Días de gracia de la rendición', 'Días que puede seguir vendiendo si debe pagar', 365, 1],
    ],
  },
]
const TODOS_PUNTOS = GRUPOS_PUNTOS.flatMap((g) => g.campos)

function PuntosAdmin() {
  const [v, setV] = useState(null)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    supabase.from('configuracion').select(TODOS_PUNTOS.map((c) => c[0]).join(',')).eq('id', 1).single()
      .then(({ data, error }) => {
        if (error) return setMsg({ tipo: 'error', texto: error.message })
        setV(Object.fromEntries(TODOS_PUNTOS.map(([k]) => [k, String(data[k])])))
      })
  }, [])

  async function guardar(e) {
    e.preventDefault()
    setMsg(null)
    const nuevo = {}
    for (const [k, titulo, , max] of TODOS_PUNTOS) {
      const n = Number(v[k])
      if (v[k] === '' || !Number.isFinite(n) || n < 0 || n > max) {
        return setMsg({ tipo: 'error', texto: '"' + titulo + '": poné un número entre 0 y ' + max + '.' })
      }
      nuevo[k] = k === 'membresia_dias_gracia' ? Math.round(n) : Math.round(n * 100) / 100
    }
    const { error } = await supabase.from('configuracion').update(nuevo).eq('id', 1)
    setMsg(error ? { tipo: 'error', texto: error.message } : { tipo: 'ok', texto: 'Guardado. Vale desde ahora; lo ya acreditado o cobrado no cambia.' })
  }

  if (!v) return <><Msg m={msg} /><p className="mu">Cargando...</p></>

  return (
    <form onSubmit={guardar}>
      {GRUPOS_PUNTOS.map((g) => (
        <div key={g.titulo} className="card">
          <h3>{g.titulo}</h3>
          <p className="mu">{g.nota}</p>
          <div className="filtros">
            {g.campos.map(([k, titulo, ayuda, max, paso]) => (
              <div key={k}>
                <label htmlFor={'pt-' + k}>{titulo}</label>
                <input id={'pt-' + k} type="number" min="0" max={max} step={paso} value={v[k]}
                  onChange={(e) => setV({ ...v, [k]: e.target.value })} required />
                <p className="mu">{ayuda}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
      <button className="btn pri">Guardar</button>
      <Msg m={msg} />
    </form>
  )
}

function ProductoresAdmin() {
  const hoy = new Date(Date.now() - 3 * 3600 * 1000)
  const actual = { a: hoy.getUTCFullYear(), m: hoy.getUTCMonth() }
  const [per, setPer] = useState(actual)
  const [lista, setLista] = useState(null)
  const [fact, setFact] = useState({})
  const [rends, setRends] = useState([])
  const [ventas, setVentas] = useState({})
  const [abierto, setAbierto] = useState(null)
  const [tiendaDe, setTiendaDe] = useState(null)
  const [msg, setMsg] = useState(null)
  const [ahora, setAhora] = useState(Date.now())

  const cargar = useCallback(async () => {
    const desde = new Date(Date.UTC(per.a, per.m, 1, 3)).toISOString()
    const hasta = new Date(Date.UTC(per.a, per.m + 1, 1, 3)).toISOString()
    const [r, f, d] = await Promise.all([
      supabase.rpc('resumen_productores'),
      supabase.rpc('facturacion_productores', { p_desde: desde, p_hasta: hasta }),
      supabase.from('rendiciones_productor').select('*, productores(cerveceria)').eq('estado', 'pendiente').order('periodo'),
    ])
    const err = r.error || f.error || d.error
    if (err) setMsg({ tipo: 'error', texto: err.message })
    setLista(r.data || [])
    setFact(Object.fromEntries((f.data || []).map((x) => [x.id, x])))
    setRends(d.data || [])
  }, [per])

  // Se refresca solo cada 30 segundos para ver los pedidos que esperan respuesta.
  useEffect(() => {
    cargar()
    const t = setInterval(() => { cargar(); setAhora(Date.now()) }, 30000)
    return () => clearInterval(t)
  }, [cargar])

  const mover = (d) => setPer(({ a, m }) => {
    const n = new Date(Date.UTC(a, m + d, 1))
    return { a: n.getUTCFullYear(), m: n.getUTCMonth() }
  })
  const esActual = per.a === actual.a && per.m === actual.m
  const mesDe = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  async function verVentas(id) {
    if (abierto === id) return setAbierto(null)
    setMsg(null)
    const { data, error } = await supabase.rpc('ventas_productor', { p_productor: id })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setVentas((m) => ({ ...m, [id]: data || [] }))
    setAbierto(id)
  }

  async function pagarRendicion(r) {
    setMsg(null)
    const { error } = await supabase.rpc('resolver_rendicion', { p_id: r.id })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: 'Rendición marcada como pagada.' + (Number(r.resultado) > 0 ? ' Si tenía los productos ocultos, vuelven a mostrarse.' : '') })
    cargar()
  }

  async function reabrir(pr) {
    setMsg(null)
    const { error } = await supabase.rpc('cambiar_tienda', { p_productor: pr.id, p_abrir: true })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: 'Tienda de ' + (pr.cerveceria || 'el productor') + ' abierta.' })
    cargar()
  }

  async function generar() {
    setMsg(null)
    const { data, error } = await supabase.rpc('generar_rendiciones')
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: data > 0 ? 'Se generaron ' + data + ' rendiciones del mes anterior.' : 'No había rendiciones nuevas para generar: ya estaban todas.' })
    cargar()
  }

  const aviso = (pr) => {
    const texto = 'Hola! Tenés ' + pr.pendientes + (pr.pendientes === 1 ? ' pedido pendiente' : ' pedidos pendientes') +
      ' en la app del club. Entrá y respondelo antes de que pasen los 30 minutos, si no se cancela solo.'
    return 'https://wa.me/' + pr.whatsapp + '?text=' + encodeURIComponent(texto)
  }

  const porProducto = (filas) => {
    const m = new Map()
    filas.forEach((f) => {
      const k = f.producto + (f.formato ? ' (' + f.formato + ')' : '')
      m.set(k, (m.get(k) || 0) + f.cantidad)
    })
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }

  if (lista === null) return <><Msg m={msg} /><p className="mu">Cargando...</p></>

  return (
    <>
      <h2 style={{ marginTop: 6 }}>Productores</h2>
      <Msg m={msg} />

      {rends.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--am)' }}>
          <h3>Rendiciones pendientes</h3>
          {rends.map((r) => {
            const res = Number(r.resultado)
            return (
              <div key={r.id} className="card">
                <div className="row">
                  <b>{(r.productores && r.productores.cerveceria) || 'Productor'} · <span style={{ textTransform: 'capitalize' }}>{mesDe(r.periodo)}</span></b>
                  <span className={'pill ' + (res > 0 ? 'bad' : 'warn')}>Ticket N.º {r.id}</span>
                </div>
                <p>Cobrado en pesos: {pesos(r.ingreso_pesos)} · Puntos: {fmt(r.puntos)} (valen {pesos(r.puntos_pesos)})</p>
                <p>{r.porcentaje}% sobre {pesos(Number(r.ingreso_pesos) + Number(r.puntos_pesos))} = {pesos(r.comision)}, menos {pesos(r.puntos_pesos)} en puntos</p>
                <p><b>{res > 0 ? 'Debe pagar el productor: ' + pesos(res) : res < 0 ? 'Debe pagar el club: ' + pesos(-res) : 'Sin saldo'}</b></p>
                {res > 0 && r.vence_gracia && <p className="mu">Puede vender hasta el {new Date(r.vence_gracia + 'T00:00:00').toLocaleDateString('es-AR')}; después se le ocultan los productos.</p>}
                <button type="button" className="btn pri" style={{ marginTop: 8 }} onClick={() => pagarRendicion(r)}>Marcar como pagada</button>
              </div>
            )
          })}
        </div>
      )}

      <div className="card">
        <div className="row">
          <button type="button" className="btn" aria-label="Mes anterior" onClick={() => mover(-1)}>◀</button>
          <h3 style={{ textTransform: 'capitalize' }}>{mesLargo(per.a, per.m)}</h3>
          <button type="button" className="btn" aria-label="Mes siguiente" disabled={esActual} onClick={() => mover(1)}>▶</button>
        </div>
        <p className="mu" style={{ marginTop: 8 }}>La facturación de cada productor se cuenta en el mes en que marca el pedido como entregado.</p>
      </div>

      {lista.length === 0 && (
        <p className="mu">Todavía no hay productores. En Ajustes y roles elegí un usuario y ponele el rol Productor.</p>
      )}
      {lista.map((pr) => {
        const espera = pr.pendientes > 0 ? Math.floor((ahora - new Date(pr.mas_antiguo).getTime()) / 60000) : 0
        const clase = pr.pendientes === 0 ? 'ok' : espera >= 20 ? 'bad' : 'warn'
        const texto = pr.pendientes === 0 ? 'Sin pendientes' : pr.pendientes + ' pendiente' + (pr.pendientes === 1 ? '' : 's') + ' · hace ' + Math.max(0, espera) + ' min'
        const filas = ventas[pr.id] || []
        const f = fact[pr.id]
        return (
          <div key={pr.id} className="card">
            <div className="row"><b>{pr.cerveceria || 'Sin nombre de cervecería'}</b><span className={'pill ' + clase}>{texto}</span></div>
            <p className="mu">{pr.nombre || 'Sin nombre'} · {pr.whatsapp ? 'WhatsApp ' + pr.whatsapp : 'Sin WhatsApp cargado'}</p>
            <p>
              Tienda: <span className={'pill ' + (pr.tienda_abierta ? 'ok' : 'bad')}>{pr.tienda_abierta ? 'Abierta' : 'Cerrada'}</span>
              {pr.tienda_bloqueada && <span className="msg error" style={{ marginLeft: 8 }}>Se cerró sola por 3 pedidos sin respuesta</span>}
            </p>
            {pr.sin_cerrar > 0 && <p className="msg error">{pr.sin_cerrar} {pr.sin_cerrar === 1 ? 'pedido aceptado' : 'pedidos aceptados'} sin cerrar hace más de 7 días.</p>}
            {f && (
              <div style={{ marginTop: 8 }}>
                <p className="mu" style={{ textTransform: 'capitalize' }}>Facturación de {mesLargo(per.a, per.m)} ({f.cant_pedidos} pedidos entregados)</p>
                <p>Cobrado en pesos: <b>{pesos(f.pesos_cobrados)}</b></p>
                <p>Puntos: <b className="pts">{fmt(f.puntos)}</b> (equivalen a {pesos(f.puntos_en_pesos)})</p>
                <p>Ingreso total del mes: <b>{pesos(f.ingreso_total)}</b></p>
              </div>
            )}
            <p className="mu" style={{ marginTop: 8 }}>
              Desde siempre: entregados {pr.aceptados} · en proceso {pr.en_proceso} · no entregados {pr.no_entregados} · rechazados {pr.rechazados} · sin respuesta {pr.vencidos}
            </p>
            <div className="row" style={{ marginTop: 10 }}>
              <button type="button" className="btn" onClick={() => verVentas(pr.id)}>{abierto === pr.id ? 'Ocultar ventas' : 'Ver ventas'}</button>
              <button type="button" className="btn" onClick={() => setTiendaDe(tiendaDe === pr.id ? null : pr.id)}>{tiendaDe === pr.id ? 'Ocultar tienda' : 'Tienda'}</button>
              {pr.tienda_bloqueada && <button type="button" className="btn pri" onClick={() => reabrir(pr)}>Reabrir tienda</button>}
              {pr.pendientes > 0 && pr.whatsapp && (
                <a className="btn pri" href={aviso(pr)} target="_blank" rel="noreferrer">Avisar por WhatsApp</a>
              )}
            </div>
            {tiendaDe === pr.id && <div style={{ marginTop: 12 }}><TiendaControl productorId={pr.id} titulo={'Tienda de ' + (pr.cerveceria || 'productor')} propia={false} /></div>}
            {abierto === pr.id && (
              <div style={{ marginTop: 12 }}>
                {filas.length === 0 && <p className="mu">Todavía no tiene ventas entregadas.</p>}
                {filas.length > 0 && (
                  <>
                    <h3>Total por producto</h3>
                    {porProducto(filas).map(([k, n]) => <p key={k}>{n} × {k}</p>)}
                    <h3 style={{ marginTop: 12 }}>Detalle (últimas {filas.length})</h3>
                    <div style={{ overflowX: 'auto' }}>
                      <table>
                        <thead><tr><th>Entrega</th><th>Pedido</th><th>Producto</th><th>Cant.</th></tr></thead>
                        <tbody>
                          {filas.map((fl, i) => (
                            <tr key={i}>
                              <td>{fechaHora(fl.fecha)}</td><td>{fl.pedido}</td>
                              <td>{fl.producto}{fl.formato ? ' (' + fl.formato + ')' : ''}</td><td>{fl.cantidad}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}

      <div className="card">
        <h3>Rendiciones del mes</h3>
        <p className="mu">Se generan solas el día 1 de cada mes: porcentaje pactado sobre el ingreso del mes anterior, menos el valor de los puntos. Si hace falta, podés generarlas a mano: no duplica las que ya existen.</p>
        <button type="button" className="btn" style={{ marginTop: 8 }} onClick={generar}>Generar rendiciones del mes anterior</button>
      </div>
    </>
  )
}
