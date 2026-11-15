// Estadísticas gráficas para el admin: ventas (pedidos entregados) y uso de la app.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { Msg, fmt, plata } from './ui'

const pesos = (n) => '$ ' + plata(n)
const PALETA = ['#8b5cf6', '#7dd3fc', '#6ee7b7', '#fbbf24', '#f472b6', '#fb923c', '#a78bfa', '#34d399']
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DIAS_LARGO = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const PERIODOS = [['semana', 'Esta semana'], ['mes', 'Este mes'], ['anterior', 'Mes anterior'], ['todo', 'Todo']]

const dos = (n) => String(n).padStart(2, '0')
const fechaAr = (ms) => { const d = new Date(ms - 3 * 3600 * 1000); return d.getUTCFullYear() + '-' + dos(d.getUTCMonth() + 1) + '-' + dos(d.getUTCDate()) }

// Rango del período en hora argentina: ventas usa instantes, uso usa fechas (hasta exclusivo).
function rango(id) {
  const ar = new Date(Date.now() - 3 * 3600 * 1000)
  const y = ar.getUTCFullYear()
  const m = ar.getUTCMonth()
  const d = ar.getUTCDate()
  const lunes = d - ((ar.getUTCDay() + 6) % 7)
  let desde = null
  let hasta = null
  if (id === 'semana') desde = Date.UTC(y, m, lunes, 3)
  if (id === 'mes') desde = Date.UTC(y, m, 1, 3)
  if (id === 'anterior') { desde = Date.UTC(y, m - 1, 1, 3); hasta = Date.UTC(y, m, 1, 3) }
  return {
    ventas: { p_desde: desde === null ? null : new Date(desde).toISOString(), p_hasta: hasta === null ? null : new Date(hasta).toISOString() },
    uso: { p_desde: desde === null ? null : fechaAr(desde), p_hasta: hasta === null ? null : fechaAr(hasta) },
  }
}

function Tarjeta({ titulo, valor, color }) {
  return (
    <div className="card" style={{ flex: '1 1 140px', margin: 0, borderTop: '3px solid ' + color }}>
      <p className="mu">{titulo}</p>
      <p className="pts" style={{ fontSize: 24 }}>{valor}</p>
    </div>
  )
}

// Barras verticales (días, horas).
function Columnas({ datos, color, etiquetaCada = 1 }) {
  const max = Math.max(...datos.map((d) => d.v), 0)
  const mejor = max > 0 ? datos.findIndex((d) => d.v === max) : -1
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: datos.length > 10 ? 3 : 8, height: 160, marginTop: 8 }}>
      {datos.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', height: '100%', minWidth: 0 }} title={d.etiqueta + ': ' + d.texto}>
          {datos.length <= 10 && <span className="mu" style={{ fontSize: 11, marginBottom: 2 }}>{d.v > 0 ? d.corto : ''}</span>}
          <div style={{ width: '100%', height: max > 0 ? Math.max(d.v > 0 ? 3 : 0, (d.v / max) * 100) + '%' : 0, background: i === mejor ? color : color + '88', borderRadius: '5px 5px 0 0' }} />
          <span className="mu" style={{ fontSize: 10, marginTop: 4, height: 12, whiteSpace: 'nowrap' }}>{i % etiquetaCada === 0 ? d.etiqueta : ''}</span>
        </div>
      ))}
    </div>
  )
}

// Barras horizontales con ranking (estilo, formato, cervecería).
function Ranking({ filas, formato }) {
  const lista = filas.slice(0, 10)
  const max = Math.max(...lista.map((f) => f.v), 0)
  if (lista.length === 0 || max === 0) return <p className="mu">Todavía no hay ventas en este período.</p>
  return (
    <div style={{ marginTop: 8 }}>
      {lista.map((f, i) => (
        <div key={f.nombre} style={{ marginBottom: 8 }}>
          <div className="row" style={{ flexWrap: 'nowrap', gap: 8 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nombre}</span>
            <b style={{ whiteSpace: 'nowrap' }}>{formato(f.v)}</b>
          </div>
          <div style={{ background: 'var(--bg)', borderRadius: 6, height: 12, marginTop: 3 }}>
            <div style={{ width: Math.max(2, (f.v / max) * 100) + '%', height: '100%', background: PALETA[i % PALETA.length], borderRadius: 6 }} />
          </div>
        </div>
      ))}
      {filas.length > 10 && <p className="mu">Se muestran las 10 primeras.</p>}
    </div>
  )
}

function Cabecera({ per, setPer, cargar, cargando }) {
  return (
    <>
      <div className="chips">
        {PERIODOS.map(([id, t]) => <button key={id} type="button" className={'chip' + (per === id ? ' on' : '')} onClick={() => setPer(id)}>{t}</button>)}
      </div>
      <button type="button" className="btn" onClick={cargar} disabled={cargando}>{cargando ? 'Actualizando...' : 'Actualizar'}</button>
    </>
  )
}

function Ventas() {
  const [per, setPer] = useState('mes')
  const [d, setD] = useState(null)
  const [unidad, setUnidad] = useState('pesos')
  const [msg, setMsg] = useState(null)
  const [cargando, setCargando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setMsg(null)
    const { data, error } = await supabase.rpc('ventas_resumen', rango(per).ventas)
    setCargando(false)
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setD(data)
  }, [per])
  useEffect(() => { cargar() }, [cargar])

  const esPesos = unidad === 'pesos'
  const val = (f) => Number(esPesos ? f.pesos : f.unidades)
  const txt = (n) => (esPesos ? pesos(n) : fmt(n) + (n === 1 ? ' unidad' : ' unidades'))
  const corto = (n) => (esPesos ? (n >= 1000 ? Math.round(n / 1000) + 'k' : String(Math.round(n))) : String(n))

  const dias = d ? d.por_dia.map((f, i) => ({ v: val(f), etiqueta: DIAS[i], corto: corto(val(f)), texto: txt(val(f)) })) : []
  const horas = d ? d.por_hora.map((f) => ({ v: val(f), etiqueta: String(f.n), corto: corto(val(f)), texto: txt(val(f)) })) : []
  const mejorDia = d && dias.some((x) => x.v > 0) ? DIAS_LARGO[dias.findIndex((x) => x.v === Math.max(...dias.map((y) => y.v)))] : null
  const mejorHora = d && horas.some((x) => x.v > 0) ? horas.findIndex((x) => x.v === Math.max(...horas.map((y) => y.v))) : null
  const ranking = (lista) => (lista || []).map((f) => ({ nombre: f.nombre, v: val(f) })).sort((a, b) => b.v - a.v)

  return (
    <>
      <Cabecera per={per} setPer={setPer} cargar={cargar} cargando={cargando} />
      <Msg m={msg} />
      {!d ? <p className="mu">Cargando...</p> : (
        <>
          <p className="mu">Solo pedidos entregados (confirmados). Los puntos se cuentan a su valor en pesos. Días y horarios en hora de Argentina.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <Tarjeta titulo="Total vendido" valor={pesos(d.total)} color={PALETA[0]} />
            <Tarjeta titulo="Pedidos entregados" valor={fmt(d.pedidos)} color={PALETA[1]} />
            <Tarjeta titulo="Ticket promedio" valor={d.pedidos > 0 ? pesos(Number(d.total) / d.pedidos) : '-'} color={PALETA[2]} />
            <Tarjeta titulo="Unidades vendidas" valor={fmt(d.unidades)} color={PALETA[3]} />
          </div>
          <div className="chips">
            <button type="button" className={'chip' + (esPesos ? ' on' : '')} onClick={() => setUnidad('pesos')}>Ver en pesos</button>
            <button type="button" className={'chip' + (!esPesos ? ' on' : '')} onClick={() => setUnidad('unidades')}>Ver en unidades</button>
          </div>
          <div className="card">
            <h3>Ventas por día de la semana</h3>
            {mejorDia && <p className="mu">El día que más se vende: <b>{mejorDia}</b></p>}
            <Columnas datos={dias} color={PALETA[0]} />
          </div>
          <div className="card">
            <h3>Ventas por horario</h3>
            {mejorHora !== null && <p className="mu">La hora más fuerte: <b>{mejorHora}:00 a {mejorHora}:59</b></p>}
            <Columnas datos={horas} color={PALETA[1]} etiquetaCada={3} />
          </div>
          <div className="card"><h3>Por estilo de cerveza</h3><Ranking filas={ranking(d.por_estilo)} formato={txt} /></div>
          <div className="card"><h3>Por formato</h3><Ranking filas={ranking(d.por_formato)} formato={txt} /></div>
          <div className="card"><h3>Por cervecería</h3><Ranking filas={ranking(d.por_cerveceria)} formato={txt} /></div>
        </>
      )}
    </>
  )
}

function Uso() {
  const [per, setPer] = useState('mes')
  const [d, setD] = useState(null)
  const [msg, setMsg] = useState(null)
  const [cargando, setCargando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setMsg(null)
    const { data, error } = await supabase.rpc('uso_resumen', rango(per).uso)
    setCargando(false)
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setD(data)
  }, [per])
  useEffect(() => { cargar() }, [cargar])

  const dias = d ? d.por_dia.slice(-31).map((f) => ({ v: Number(f.usuarios), etiqueta: f.dia.slice(8) + '/' + f.dia.slice(5, 7), corto: String(f.usuarios), texto: f.usuarios + ' usuarios · ' + f.aperturas + ' aperturas' })) : []
  const horas = d ? d.por_hora.map((f) => ({ v: Number(f.aperturas), etiqueta: String(f.n), corto: String(f.aperturas), texto: f.aperturas + ' aperturas' })) : []
  const mejorHora = d && horas.some((x) => x.v > 0) ? horas.findIndex((x) => x.v === Math.max(...horas.map((y) => y.v))) : null
  const sinComprar = d ? Number(d.socios) - Number(d.socios_compraron) : 0
  const ROLES = { socio: 'Socios', productor: 'Productores', personal: 'Personal', admin: 'Admin' }
  const roles = d ? d.por_rol.map((f) => ({ nombre: ROLES[f.rol] || f.rol, v: Number(f.usuarios) })) : []

  return (
    <>
      <Cabecera per={per} setPer={setPer} cargar={cargar} cargando={cargando} />
      <Msg m={msg} />
      {!d ? <p className="mu">Cargando...</p> : (
        <>
          <p className="mu">Cuenta cada vez que alguien abre la app (como mucho una vez cada 30 minutos por dispositivo). Se guarda desde {d.desde ? d.desde.split('-').reverse().join('/') : 'ahora'} y se borra lo de más de 90 días; no hay datos anteriores.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <Tarjeta titulo="Usuarios distintos" valor={fmt(d.usuarios)} color={PALETA[0]} />
            <Tarjeta titulo="Aperturas de la app" valor={fmt(d.aperturas)} color={PALETA[1]} />
            <Tarjeta titulo="Socios que compraron" valor={fmt(d.socios_compraron) + ' de ' + fmt(d.socios)} color={PALETA[2]} />
            <Tarjeta titulo="Entraron y no compraron" valor={fmt(sinComprar)} color={PALETA[3]} />
          </div>
          <div className="card">
            <h3>Usuarios distintos por día</h3>
            {dias.length === 0 ? <p className="mu">Todavía no hay registros en este período.</p> : <Columnas datos={dias} color={PALETA[0]} etiquetaCada={dias.length > 10 ? 5 : 1} />}
          </div>
          <div className="card">
            <h3>Aperturas por horario</h3>
            {mejorHora !== null && <p className="mu">Se usa más entre las <b>{mejorHora}:00 y las {mejorHora}:59</b></p>}
            <Columnas datos={horas} color={PALETA[1]} etiquetaCada={3} />
          </div>
          <div className="card"><h3>Usuarios por rol</h3><Ranking filas={roles} formato={(n) => fmt(n)} /></div>
        </>
      )}
    </>
  )
}

export default function VentasUso() {
  const [sub, setSub] = useState('ventas')
  return (
    <>
      <h2 style={{ marginTop: 6 }}>Estadísticas</h2>
      <div className="chips">
        <button type="button" className={'chip' + (sub === 'ventas' ? ' on' : '')} onClick={() => setSub('ventas')}>Ventas</button>
        <button type="button" className={'chip' + (sub === 'uso' ? ' on' : '')} onClick={() => setSub('uso')}>Uso de la app</button>
      </div>
      {sub === 'ventas' ? <Ventas /> : <Uso />}
    </>
  )
}
