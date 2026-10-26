// Pantalla del personal del local y del administrador.
// El administrador ve ademas las pestañas Cuotas y Ajustes y roles.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Icon, Msg, Navegacion, CATS, fmt, fechaHora } from '../ui'
import Escaner from '../Escaner'
import Movimientos from './Movimientos'

const etiqueta = (s) => `N.º ${String(s.numero_socio).padStart(4, '0')} - ${s.nombre || 'Sin nombre'}`

const ADMIN_MENU = [
  ['socios', 'Socios', 'Puntos y cuota de cada socio', 'crown'],
  ['premios', 'Premios', 'Catálogo de canjes con puntos', 'gift'],
  ['tienda', 'Tienda', 'Productos, stock y secciones', 'pint'],
  ['cuota', 'Cuotas', 'Registrar pagos de cuota', 'crown'],
  ['ajuste', 'Ajustes y roles', 'Ajustar puntos y cambiar roles', 'hop'],
  ['marca', 'Marca', 'Nombre, logos y WhatsApp', 'barrel'],
]

export default function Panel({ esAdmin, marca, onMarca }) {
  const [vista, setVista] = useState('carga')
  const [sub, setSub] = useState(null)
  const [socios, setSocios] = useState([])
  const [pendientes, setPendientes] = useState(0)

  const cargarSocios = useCallback(async () => {
    const { data } = await supabase
      .from('perfiles')
      .select('id, nombre, numero_socio, rol, cuota_pagada_hasta')
      .order('numero_socio')
    setSocios(data || [])
  }, [])

  const contarPendientes = useCallback(async () => {
    const cuenta = (tabla) => supabase.from(tabla).select('id', { count: 'exact', head: true }).eq('estado', 'pendiente')
    const [a, b] = await Promise.all([cuenta('pagos_informados'), cuenta('pedidos')])
    setPendientes((a.count || 0) + (b.count || 0))
  }, [])

  useEffect(() => { cargarSocios() }, [cargarSocios])
  useEffect(() => { contarPendientes() }, [contarPendientes, vista])

  const soloSocios = socios.filter((s) => s.rol === 'socio')
  const items = [
    ['carga', 'Cargar', 'recarga'],
    ['cupon', 'Canjear', 'gift'],
    ['cobros', 'Cobros', 'crown', pendientes],
    ['mov', 'Movimientos', 'barrel'],
    ...(esAdmin ? [['admin', 'Admin', 'hop']] : []),
  ]

  return (
    <>
      {vista === 'carga' && <Carga />}
      {vista === 'cupon' && <Cupon />}
      {vista === 'cobros' && <Cobros onCambio={contarPendientes} />}
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
          {sub === 'premios' && <Premios />}
          {sub === 'tienda' && <TiendaAdmin />}
          {sub === 'cuota' && <Cuotas socios={soloSocios} recargar={cargarSocios} />}
          {sub === 'ajuste' && <Ajustes socios={socios} recargar={cargarSocios} />}
          {sub === 'marca' && <Marca marca={marca} onGuardado={onMarca} />}
        </>
      )}
      <Navegacion items={items} actual={vista} onElegir={(id) => { setVista(id); setSub(null) }} />
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
      <p className="mu">1 litro suma 1 punto. Cada unidad extra suma 0,25 puntos.</p>
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
          <label htmlFor="c-litros">Litros recargados</label>
          <input id="c-litros" type="number" min="0" step="0.1" value={litros} onChange={(e) => setLitros(e.target.value)} />
          <label htmlFor="c-extras">Unidades extra o estilos especiales</label>
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

  async function pagar(s) {
    setMsg(null)
    const { error } = await supabase.rpc('registrar_pago_cuota', { p_socio: s.id })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: 'Pago registrado para ' + s.nombre + '.' })
    recargar()
  }

  return (
    <div className="card">
      <h3>Cuotas mensuales ($15.000)</h3>
      <p className="mu">Cada pago corre un mes la fecha hasta la que el socio está al día.</p>
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

function Socios() {
  const [lista, setLista] = useState([])
  const [orden, setOrden] = useState('acumulado')
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    supabase.rpc('resumen_socios').then(({ data, error }) => {
      if (error) return setMsg({ tipo: 'error', texto: error.message })
      setLista(data || [])
    })
  }, [])

  const ordenada = [...lista].sort((a, b) =>
    orden === 'numero' ? a.numero_socio - b.numero_socio : Number(b[orden]) - Number(a[orden]))

  return (
    <div className="card">
      <h3>Socios</h3>
      <p className="mu">Puntos adquiridos = todos los puntos que el socio sumó por recargas. Sirve para ver quién es el más fiel.</p>
      <div className="chips">
        {[['acumulado', 'Más fieles'], ['saldo', 'Más puntos actuales'], ['numero', 'Número de socio']].map(([id, t]) => (
          <button key={id} className={'chip' + (orden === id ? ' on' : '')} onClick={() => setOrden(id)}>{t}</button>
        ))}
      </div>
      <Msg m={msg} />
      <div className="scroll">
        <table>
          <thead><tr><th>#</th><th>Socio</th><th>Puntos actuales</th><th>Puntos adquiridos</th><th>Cuota</th></tr></thead>
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
    if (await actualizar({ nombre_app: f.nombre_app.trim(), descripcion: f.descripcion.trim(), whatsapp: wa || null, aviso_envio: f.aviso_envio.trim() }))
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

function Cobros({ onCambio }) {
  const [pagos, setPagos] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [msg, setMsg] = useState(null)

  const cargar = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from('pagos_informados').select('*, perfiles(numero_socio, nombre)').eq('estado', 'pendiente').order('creado_en'),
      supabase.from('pedidos').select('*, perfiles(numero_socio, nombre), pedido_items(*)').eq('estado', 'pendiente').order('creado_en'),
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

  const resolverPedido = (id, accion) => {
    if (accion === 'cancelar' && !window.confirm('¿Cancelar el pedido? Se devuelven el stock y, si pagó con puntos, los puntos.')) return
    return resolver(supabase.rpc('resolver_pedido', { p_id: id, p_accion: accion }),
      accion === 'confirmar' ? 'Pedido confirmado.' : 'Pedido cancelado: stock devuelto.')
  }

  const quien = (p) => 'Socio N.º ' + String(p.perfiles.numero_socio).padStart(4, '0') + ' · ' + (p.perfiles.nombre || 'Sin nombre')

  return (
    <>
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

      <h2>Pedidos de la tienda</h2>
      {pedidos.length === 0 && <p className="mu">No hay pedidos pendientes.</p>}
      {pedidos.map((p) => (
        <div key={p.id} className="card">
          <div className="row"><b>Pedido N.º {p.numero}</b><span className="mu">{fechaHora(p.creado_en)}</span></div>
          <p>{quien(p)}</p>
          {p.pedido_items.map((i) => <p key={i.id}>{i.cantidad} × {i.nombre}{i.formato ? ' (' + i.formato + ')' : ''}</p>)}
          <p className="pts" style={{ marginTop: 6 }}>{p.pago === 'puntos' ? fmt(p.total_puntos) + ' pts (ya descontados)' : pesos(p.total_pesos)}</p>
          <p className="mu">Pago: {PAGO_TXT[p.pago]} · {p.entrega === 'envio' ? 'Envío a ' + p.direccion : 'Retiro en el local'}</p>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" onClick={() => resolverPedido(p.id, 'cancelar')}>Cancelar pedido</button>
            <button className="btn pri" onClick={() => resolverPedido(p.id, 'confirmar')}>{p.pago === 'puntos' ? 'Confirmar entrega' : 'Confirmar pago y entrega'}</button>
          </div>
        </div>
      ))}
      <Msg m={msg} />
    </>
  )
}

function CamposProducto({ r, set, secciones, id }) {
  return (
    <div className="filtros">
      <div><label htmlFor={id + '-n'}>Nombre</label><input id={id + '-n'} value={r.nombre} onChange={(e) => set('nombre', e.target.value)} required /></div>
      <div>
        <label htmlFor={id + '-s'}>Sección</label>
        <select id={id + '-s'} value={r.seccion} onChange={(e) => set('seccion', e.target.value)}>
          {secciones.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
      </div>
      <div><label htmlFor={id + '-f'}>Formato</label><input id={id + '-f'} placeholder="1 litro" value={r.formato ?? ''} onChange={(e) => set('formato', e.target.value)} /></div>
      <div><label htmlFor={id + '-p'}>Precio ($)</label><input id={id + '-p'} type="number" min="0" step="1" value={r.precio_pesos} onChange={(e) => set('precio_pesos', e.target.value)} required /></div>
      <div><label htmlFor={id + '-pp'}>Precio en puntos (opcional)</label><input id={id + '-pp'} type="number" min="0" step="0.25" value={r.precio_puntos ?? ''} onChange={(e) => set('precio_puntos', e.target.value)} /></div>
      <div><label htmlFor={id + '-st'}>Stock (unidades)</label><input id={id + '-st'} type="number" min="0" step="1" value={r.stock} onChange={(e) => set('stock', e.target.value)} required /></div>
      <div style={{ gridColumn: '1 / -1' }}>
        <label htmlFor={id + '-d'}>Descripción (opcional, por ejemplo qué incluye el combo)</label>
        <input id={id + '-d'} value={r.descripcion ?? ''} onChange={(e) => set('descripcion', e.target.value)} />
      </div>
    </div>
  )
}

function TiendaAdmin() {
  const vacio = { seccion: 'cervezas', nombre: '', formato: '', descripcion: '', precio_pesos: '', precio_puntos: '', stock: '' }
  const [secciones, setSecciones] = useState([])
  const [lista, setLista] = useState([])
  const [nuevo, setNuevo] = useState(vacio)
  const [msg, setMsg] = useState(null)

  const cargar = useCallback(async () => {
    const [s, p] = await Promise.all([
      supabase.from('tienda_secciones').select('*').order('orden'),
      supabase.from('tienda_productos').select('*').order('seccion').order('nombre'),
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
    precio_puntos: r.precio_puntos === '' || r.precio_puntos == null ? null : Number(r.precio_puntos),
    stock: Math.max(0, Math.floor(Number(r.stock || 0))),
  })

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

      <form className="card" onSubmit={agregar}>
        <h3>Agregar producto</h3>
        <CamposProducto r={nuevo} set={(c, v) => setNuevo({ ...nuevo, [c]: v })} secciones={secciones} id="nuevo" />
        <button className="btn pri" style={{ marginTop: 16 }}>Agregar producto</button>
      </form>
      <Msg m={msg} />

      <h2>Productos</h2>
      {lista.length === 0 && <p className="mu">Todavía no cargaste productos.</p>}
      {lista.map((r) => (
        <div key={r.id} className="card" style={{ opacity: r.activo ? 1 : 0.6 }}>
          <CamposProducto r={r} set={(c, v) => editar(r.id, c, v)} secciones={secciones} id={r.id} />
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
