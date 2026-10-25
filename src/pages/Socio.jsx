import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Icon, Coin, Msg, CATS, fmt, fechaHora, TIPOS } from '../ui'

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

export default function Socio({ perfil }) {
  const [p, setP] = useState(perfil)
  const [saldo, setSaldo] = useState(0)
  const [movs, setMovs] = useState([])
  const [recs, setRecs] = useState([])
  const [cat, setCat] = useState(CATS[0])
  const [cupon, setCupon] = useState(null)
  const [msg, setMsg] = useState(null)

  const cargar = useCallback(async () => {
    const [s, m, r, pf] = await Promise.all([
      supabase.rpc('saldo_disponible', { p_socio: perfil.id }),
      supabase.from('movimientos_puntos').select('*').order('creado_en', { ascending: false }).limit(10),
      supabase.from('recompensas').select('*').order('puntos_costo'),
      supabase.from('perfiles').select('*').eq('id', perfil.id).single(),
    ])
    setSaldo(s.data ?? 0)
    setMovs(m.data || [])
    setRecs(r.data || [])
    if (pf.data) setP(pf.data)
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

  const e = estadoCuota(p)

  return (
    <>
      <div className="member">
        <h2 style={{ margin: 0 }}>{p.nombre || 'Socio'}</h2>
        <p className="mu">Socio N.º {String(p.numero_socio).padStart(4, '0')}</p>
        <p className="mu" style={{ marginTop: 14 }}>Saldo disponible</p>
        <div className="bal num"><Coin />{fmt(saldo)}</div>
        <p className="mu">puntos</p>
      </div>

      <div className={'estado ' + e.clase}>
        <b>{e.titulo}</b>
        <span>{e.texto}</span>
      </div>

      {cupon && (
        <div className="card" style={{ borderColor: 'var(--am)' }}>
          <h3>Tu cupón de canje</h3>
          <div className="codigo">{cupon.codigo}</div>
          <p className="mu" style={{ textAlign: 'center' }}>
            Mostralo en caja antes de las {new Date(cupon.vence_en).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}. Se usa una sola vez.
          </p>
          <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
            <button className="btn" onClick={cancelar}>Cancelar cupón</button>
            <button className="btn" onClick={() => setCupon(null)}>Cerrar</button>
          </div>
        </div>
      )}

      <h2>Canjes</h2>
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

      <h2>Pasar puntos a otro socio</h2>
      <Transferir onListo={cargar} />

      <h2>Últimos movimientos</h2>
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
    </>
  )
}

function Transferir({ onListo }) {
  const [numero, setNumero] = useState('')
  const [puntos, setPuntos] = useState('')
  const [msg, setMsg] = useState(null)

  async function enviar(e) {
    e.preventDefault()
    setMsg(null)
    const { data, error } = await supabase.rpc('transferir_puntos', {
      p_numero_socio: Number(numero), p_puntos: Number(puntos),
    })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: 'Enviaste ' + fmt(puntos) + ' puntos al socio N.º ' + String(numero).padStart(4, '0') + '. Tu saldo disponible ahora es ' + fmt(data) + '.' })
    setNumero('')
    setPuntos('')
    onListo()
  }

  return (
    <form className="card" onSubmit={enviar}>
      <p className="mu">Solo se puede pasar el saldo disponible, el que no está reservado en un cupón.</p>
      <label htmlFor="t-num">Número de socio</label>
      <input id="t-num" type="number" min="1" step="1" value={numero} onChange={(e) => setNumero(e.target.value)} required />
      <label htmlFor="t-pts">Puntos a pasar</label>
      <input id="t-pts" type="number" min="0.25" step="0.25" value={puntos} onChange={(e) => setPuntos(e.target.value)} required />
      <button className="btn pri" style={{ marginTop: 16 }}><Icon name="gift" size={18} />Pasar puntos</button>
      <Msg m={msg} />
    </form>
  )
}
