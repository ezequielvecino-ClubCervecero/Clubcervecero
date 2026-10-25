// Pantalla del personal del local y del administrador.
// El administrador ve ademas las pestañas Cuotas y Ajustes y roles.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Icon, Msg, CATS, fmt } from '../ui'
import Movimientos from './Movimientos'

const etiqueta = (s) => `N.º ${String(s.numero_socio).padStart(4, '0')} - ${s.nombre || 'Sin nombre'}`

export default function Panel({ esAdmin }) {
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
    ...(esAdmin ? [['premios', 'Premios', 'pint'], ['cuota', 'Cuotas', 'crown'], ['ajuste', 'Ajustes y roles', 'hop']] : []),
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
      {tab === 'premios' && <Premios />}
      {tab === 'cuota' && <Cuotas socios={socios.filter((s) => s.rol === 'socio')} recargar={cargarSocios} />}
      {tab === 'ajuste' && <Ajustes socios={socios} recargar={cargarSocios} />}
    </>
  )
}

function Carga({ socios }) {
  const [socio, setSocio] = useState('')
  const [litros, setLitros] = useState('')
  const [extras, setExtras] = useState('0')
  const [msg, setMsg] = useState(null)

  async function enviar(e) {
    e.preventDefault()
    setMsg(null)
    const { data, error } = await supabase.rpc('registrar_carga', {
      p_socio: socio, p_litros: Number(litros), p_unidades_extra: Number(extras),
    })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: 'Carga registrada. Saldo total del socio: ' + fmt(data) + ' puntos.' })
    setLitros('')
    setExtras('0')
  }

  return (
    <form className="card" onSubmit={enviar}>
      <h3>Registrar carga de puntos</h3>
      <p className="mu">1 litro suma 1 punto. Cada unidad extra suma 0,25 puntos.</p>
      <label htmlFor="c-socio">Socio</label>
      <select id="c-socio" value={socio} onChange={(e) => setSocio(e.target.value)} required>
        <option value="">Elegí un socio</option>
        {socios.map((s) => <option key={s.id} value={s.id}>{etiqueta(s)}</option>)}
      </select>
      <label htmlFor="c-litros">Litros recargados</label>
      <input id="c-litros" type="number" min="0" step="0.1" value={litros} onChange={(e) => setLitros(e.target.value)} />
      <label htmlFor="c-extras">Unidades extra o estilos especiales</label>
      <input id="c-extras" type="number" min="0" step="1" value={extras} onChange={(e) => setExtras(e.target.value)} />
      <button className="btn pri" style={{ marginTop: 16 }}><Icon name="recarga" size={18} />Registrar carga</button>
      <Msg m={msg} />
    </form>
  )
}

function Cupon() {
  const [codigo, setCodigo] = useState('')
  const [msg, setMsg] = useState(null)

  async function enviar(e) {
    e.preventDefault()
    setMsg(null)
    const { data, error } = await supabase.rpc('canjear_cupon', { p_codigo: codigo.trim() })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: 'Cupón canjeado. Se descontaron ' + fmt(data.puntos) + ' puntos al socio.' })
    setCodigo('')
  }

  return (
    <form className="card" onSubmit={enviar}>
      <h3>Canjear cupón</h3>
      <p className="mu">Pedile al socio el código de 8 caracteres de su cupón.</p>
      <label htmlFor="cp">Código del cupón</label>
      <input id="cp" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} maxLength={8} required />
      <button className="btn pri" style={{ marginTop: 16 }}><Icon name="gift" size={18} />Validar y canjear</button>
      <Msg m={msg} />
    </form>
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
