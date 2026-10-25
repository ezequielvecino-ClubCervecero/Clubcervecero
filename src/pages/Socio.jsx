import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Icon, Coin, Msg, Acordeon, CATS, fmt, fechaHora, TIPOS } from '../ui'

const COSTO_TRANSFERENCIA = 0.5

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
  const [abierta, setAbierta] = useState(null)
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
  const alternar = (k) => setAbierta((a) => (a === k ? null : k))

  return (
    <>
      <div className="member">
        <h2 style={{ margin: 0 }}>{p.nombre || 'Socio'}</h2>
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

      <Acordeon titulo="Canjes" icono="gift" abierto={abierta === 'canjes'} onToggle={() => alternar('canjes')}>
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
      </Acordeon>

      <Acordeon titulo="Pasar puntos" icono="recarga" abierto={abierta === 'pasar'} onToggle={() => alternar('pasar')}>
        <Transferir onListo={cargar} alDia={e.clase === 'ok'} />
      </Acordeon>

      <Acordeon titulo="Ranking del mes" icono="crown" abierto={abierta === 'ranking'} onToggle={() => alternar('ranking')}>
        <Ranking p={p} />
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
      <p className="mu">Puntos sumados por recargas en {mes}. Solo aparecen los socios que eligieron un apodo.</p>
      {!p.apodo && <p className="msg error">Elegí tu apodo en "Mi apodo" para aparecer en el ranking.</p>}
      {filas && filas.length === 0 && <p className="mu">Todavía nadie sumó puntos este mes.</p>}
      {(filas || []).map((f) => (
        <div key={f.posicion} className={'card row' + (f.es_mio ? ' mio' : '')}>
          <span><b>{f.posicion}.</b> {f.apodo}{f.es_mio ? ' (vos)' : ''}</span>
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
