// Pantalla del personal del local y del administrador.
// El administrador ve ademas las pestañas Cuotas y Ajustes y roles.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Icon, Msg, CATS, fmt } from '../ui'
import Movimientos from './Movimientos'

const etiqueta = (s) => `N.º ${String(s.numero_socio).padStart(4, '0')} - ${s.nombre || 'Sin nombre'}`

export default function Panel({ esAdmin, marca, onMarca }) {
  const [tab, setTab] = useState('carga')
  const [socios, setSocios] = useState([])

  const cargarSocios = useCallback(async () => {
    const { data } = await supabase
      .from('perfiles')
      .select('id, nombre, numero_socio, rol, cuota_pagada_hasta')
      .order('numero_socio')
    setSocios(data || [])
  }, [])

  useEffect(() => { cargarSocios() }, [cargarSocios])

  const tabs = [
    ['carga', 'Registrar carga', 'recarga'],
    ['cupon', 'Canjear cupón', 'gift'],
    ['mov', 'Movimientos', 'barrel'],
    ...(esAdmin ? [['socios', 'Socios', 'crown'], ['premios', 'Premios', 'pint'], ['cuota', 'Cuotas', 'crown'], ['ajuste', 'Ajustes y roles', 'hop'], ['marca', 'Marca', 'barrel']] : []),
  ]

  return (
    <>
      <div className="chips" role="tablist">
        {tabs.map(([id, texto, icono]) => (
          <button key={id} className={'chip' + (tab === id ? ' on' : '')} onClick={() => setTab(id)}>
            <Icon name={icono} size={16} />{texto}
          </button>
        ))}
      </div>
      {tab === 'carga' && <Carga socios={socios.filter((s) => s.rol === 'socio')} />}
      {tab === 'cupon' && <Cupon />}
      {tab === 'mov' && <Movimientos socios={socios} />}
      {tab === 'socios' && <Socios />}
      {tab === 'marca' && <Marca marca={marca} onGuardado={onMarca} />}
      {tab === 'premios' && <Premios />}
      {tab === 'cuota' && <Cuotas socios={socios.filter((s) => s.rol === 'socio')} recargar={cargarSocios} />}
      {tab === 'ajuste' && <Ajustes socios={socios} recargar={cargarSocios} />}
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

  const limpiar = () => { setCupon(null); setCodigo('') }

  async function ver(e) {
    e.preventDefault()
    setMsg(null)
    setCupon(null)
    const { data, error } = await supabase.rpc('ver_cupon', { p_codigo: codigo.trim() })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setCupon(data)
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
        <form onSubmit={ver}>
          <p className="mu">Pedile al socio el código de 8 caracteres de su cupón.</p>
          <label htmlFor="cp">Código del cupón</label>
          <input id="cp" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} maxLength={8} required />
          <button className="btn pri" style={{ marginTop: 16 }}><Icon name="gift" size={18} />Ver cupón</button>
        </form>
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
  const [f, setF] = useState({ nombre_app: marca.nombre_app, descripcion: marca.descripcion })
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
    if (await actualizar({ nombre_app: f.nombre_app.trim(), descripcion: f.descripcion.trim() }))
      setMsg({ tipo: 'ok', texto: 'Nombre y descripción guardados.' })
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
        <h3>Nombre y descripción</h3>
        <label htmlFor="m-nombre">Nombre de la aplicación</label>
        <input id="m-nombre" value={f.nombre_app} onChange={(e) => setF({ ...f, nombre_app: e.target.value })} required />
        <label htmlFor="m-desc">Descripción (se ve en la pantalla de ingreso)</label>
        <input id="m-desc" value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} required />
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
