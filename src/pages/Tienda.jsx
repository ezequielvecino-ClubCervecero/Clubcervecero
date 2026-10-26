// Tienda del socio: secciones, carrito, pedido y mensaje de WhatsApp.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Icon, Msg, Acordeon, fmt, fechaHora } from '../ui'

const PAGOS = [['efectivo', 'Efectivo en el local'], ['transferencia', 'Transferencia'], ['puntos', 'Puntos']]
const PAGO_TXT = Object.fromEntries(PAGOS)
const ENTREGAS = [['retiro', 'Retiro en el local'], ['envio', 'Envío a domicilio']]
const pesos = (n) => '$ ' + fmt(n)
const ESTADOS = { pendiente: ['warn', 'Pendiente'], confirmado: ['ok', 'Confirmado'], cancelado: ['bad', 'Cancelado'] }

function armarMensaje({ numero, perfil, lineas, pago, entrega, direccion, totalPesos, totalPuntos, aviso }) {
  const L = []
  L.push('Hola! Hice el pedido N.º ' + numero + ' en la app del club.')
  L.push('Socio N.º ' + String(perfil.numero_socio).padStart(4, '0') + (perfil.nombre ? ' - ' + perfil.nombre : ''))
  L.push('')
  lineas.forEach((l) => {
    const precio = pago === 'puntos' ? fmt(l.precio_puntos * l.cantidad) + ' pts' : pesos(l.precio_pesos * l.cantidad)
    L.push('• ' + l.cantidad + ' x ' + l.nombre + (l.formato ? ' (' + l.formato + ')' : '') + ' - ' + precio)
  })
  L.push('')
  L.push('Total: ' + (pago === 'puntos' ? fmt(totalPuntos) + ' puntos' : pesos(totalPesos)))
  L.push('Forma de pago: ' + PAGO_TXT[pago])
  L.push(entrega === 'envio' ? 'Entrega: envío a ' + direccion : 'Entrega: retiro en el local')
  if (entrega === 'envio' && aviso) { L.push(''); L.push(aviso) }
  return L.join('\n')
}

export default function Tienda({ perfil }) {
  const [secciones, setSecciones] = useState([])
  const [productos, setProductos] = useState([])
  const [config, setConfig] = useState({})
  const [saldo, setSaldo] = useState(0)
  const [seccion, setSeccion] = useState(null)
  const [carrito, setCarrito] = useState({})
  const [pago, setPago] = useState('efectivo')
  const [entrega, setEntrega] = useState('retiro')
  const [direccion, setDireccion] = useState('')
  const [msg, setMsg] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState(null)
  const [abierta, setAbierta] = useState(false)
  const [version, setVersion] = useState(0)

  const cargar = useCallback(async () => {
    const [s, p, c, sd] = await Promise.all([
      supabase.from('tienda_secciones').select('*').eq('visible', true).order('orden'),
      supabase.from('tienda_productos').select('*').eq('activo', true).gt('stock', 0).order('nombre'),
      supabase.from('configuracion').select('whatsapp, aviso_envio').eq('id', 1).single(),
      supabase.rpc('saldo_disponible', { p_socio: perfil.id }),
    ])
    const vis = s.data || []
    setSecciones(vis)
    setProductos((p.data || []).filter((x) => vis.some((v) => v.id === x.seccion)))
    setConfig(c.data || {})
    setSaldo(sd.data ?? 0)
    setSeccion((act) => (vis.some((v) => v.id === act) ? act : vis[0] ? vis[0].id : null))
  }, [perfil.id])
  useEffect(() => { cargar() }, [cargar])

  function cambiar(prod, delta) {
    setCarrito((c) => {
      const n = Math.min(prod.stock, Math.max(0, (c[prod.id] || 0) + delta))
      const sig = { ...c }
      if (n === 0) delete sig[prod.id]; else sig[prod.id] = n
      return sig
    })
  }

  const lineas = productos.filter((p) => carrito[p.id]).map((p) => ({ ...p, cantidad: carrito[p.id] }))
  const totalPesos = lineas.reduce((a, l) => a + l.precio_pesos * l.cantidad, 0)
  const sePuedePuntos = lineas.length > 0 && lineas.every((l) => l.precio_puntos != null)
  const totalPuntos = sePuedePuntos ? lineas.reduce((a, l) => a + l.precio_puntos * l.cantidad, 0) : 0
  const puntosOk = sePuedePuntos && saldo >= totalPuntos
  const pagoValido = pago !== 'puntos' || puntosOk
  const direccionOk = entrega === 'retiro' || direccion.trim().length > 4

  async function confirmar() {
    setMsg(null)
    setEnviando(true)
    const snapshot = { lineas, pago, entrega, direccion: direccion.trim(), totalPesos, totalPuntos, aviso: config.aviso_envio }
    const { data, error } = await supabase.rpc('crear_pedido', {
      p_items: lineas.map((l) => ({ producto_id: l.id, cantidad: l.cantidad })),
      p_pago: pago, p_entrega: entrega, p_direccion: entrega === 'envio' ? direccion.trim() : null,
    })
    setEnviando(false)
    if (error) { await cargar(); return setMsg({ tipo: 'error', texto: error.message }) }
    const texto = armarMensaje({ ...snapshot, numero: data.numero, perfil })
    const url = config.whatsapp ? 'https://wa.me/' + config.whatsapp + '?text=' + encodeURIComponent(texto) : null
    setListo({ numero: data.numero, url })
    setCarrito({})
    setDireccion('')
    setVersion((v) => v + 1)
    cargar()
  }

  if (listo) {
    return (
      <div className="card" style={{ borderColor: 'var(--am)' }}>
        <h3>Pedido N.º {listo.numero} hecho</h3>
        <p className="mu" style={{ margin: '8px 0 12px' }}>
          Quedó pendiente hasta que el local lo confirme. Mandanos el detalle por WhatsApp para coordinar.
        </p>
        {listo.url
          ? <a className="btn pri" href={listo.url} target="_blank" rel="noreferrer">Enviar por WhatsApp</a>
          : <p className="msg error">El negocio todavía no cargó su número de WhatsApp. Avisale al local en persona.</p>}
        <div style={{ marginTop: 12 }}><button className="btn" onClick={() => setListo(null)}>Seguir comprando</button></div>
      </div>
    )
  }

  const visibles = productos.filter((p) => p.seccion === seccion)

  return (
    <>
      <h2 style={{ marginTop: 6 }}>Tienda</h2>
      {secciones.length === 0 && <p className="mu">La tienda no tiene secciones disponibles por ahora.</p>}
      <div className="chips">
        {secciones.map((s) => (
          <button key={s.id} className={'chip' + (s.id === seccion ? ' on' : '')} onClick={() => setSeccion(s.id)}>{s.nombre}</button>
        ))}
      </div>
      {secciones.length > 0 && visibles.length === 0 && <p className="mu">No hay productos en esta sección.</p>}
      {visibles.map((p) => (
        <div key={p.id} className="card row">
          <div style={{ flex: 1, minWidth: 150 }}>
            <b>{p.nombre}</b>{p.formato ? <span className="mu"> · {p.formato}</span> : null}
            {p.descripcion && <p className="mu">{p.descripcion}</p>}
            <p>{pesos(p.precio_pesos)}{p.precio_puntos != null && <span className="pts" style={{ fontSize: 15 }}> · {fmt(p.precio_puntos)} pts</span>}</p>
            {p.stock <= 5 && <p className="mu">Quedan {p.stock}</p>}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" aria-label={'Quitar uno de ' + p.nombre} disabled={!carrito[p.id]} onClick={() => cambiar(p, -1)}>−</button>
            <b aria-live="polite">{carrito[p.id] || 0}</b>
            <button className="btn" aria-label={'Agregar uno de ' + p.nombre} disabled={(carrito[p.id] || 0) >= p.stock} onClick={() => cambiar(p, 1)}>+</button>
          </div>
        </div>
      ))}

      {lineas.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--am)' }}>
          <h3>Tu pedido</h3>
          {lineas.map((l) => (
            <div key={l.id} className="row" style={{ marginTop: 6 }}>
              <span>{l.cantidad} × {l.nombre}{l.formato ? ' (' + l.formato + ')' : ''}</span>
              <span>{pago === 'puntos' && l.precio_puntos != null ? fmt(l.precio_puntos * l.cantidad) + ' pts' : pesos(l.precio_pesos * l.cantidad)}</span>
            </div>
          ))}
          <label>Forma de pago</label>
          <div className="chips" style={{ marginTop: 0 }}>
            {PAGOS.map(([id, t]) => (
              <button key={id} className={'chip' + (pago === id ? ' on' : '')} onClick={() => setPago(id)}>{t}</button>
            ))}
          </div>
          {pago === 'puntos' && !pagoValido && (
            <p className="msg error">
              {!sePuedePuntos ? 'Algún producto del pedido no se puede pagar con puntos.' : 'Te faltan ' + fmt(totalPuntos - saldo) + ' puntos de saldo disponible.'}
            </p>
          )}
          <label>Entrega</label>
          <div className="chips" style={{ marginTop: 0 }}>
            {ENTREGAS.map(([id, t]) => (
              <button key={id} className={'chip' + (entrega === id ? ' on' : '')} onClick={() => setEntrega(id)}>{t}</button>
            ))}
          </div>
          {entrega === 'envio' && (
            <>
              <label htmlFor="dir">Dirección de entrega</label>
              <input id="dir" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
              {config.aviso_envio && <p className="mu" style={{ marginTop: 6 }}>{config.aviso_envio}</p>}
            </>
          )}
          <div className="row" style={{ marginTop: 14 }}>
            <b>Total</b>
            <span className="pts">{pago === 'puntos' ? fmt(totalPuntos) + ' pts' : pesos(totalPesos)}</span>
          </div>
          <button className="btn pri" style={{ marginTop: 12, width: '100%' }} disabled={enviando || !pagoValido || !direccionOk} onClick={confirmar}>
            <Icon name="pint" size={18} />{enviando ? 'Enviando...' : 'Confirmar pedido'}
          </button>
        </div>
      )}
      <Msg m={msg} />

      <div style={{ marginTop: 18 }}>
        <Acordeon titulo="Mis pedidos" icono="barrel" abierto={abierta} onToggle={() => setAbierta((a) => !a)}>
          <MisPedidos perfil={perfil} version={version} />
        </Acordeon>
      </div>
    </>
  )
}

function MisPedidos({ perfil, version }) {
  const [filas, setFilas] = useState(null)
  useEffect(() => {
    supabase.from('pedidos').select('*, pedido_items(*)').eq('socio_id', perfil.id)
      .order('creado_en', { ascending: false }).limit(10)
      .then(({ data }) => setFilas(data || []))
  }, [perfil.id, version])

  if (filas && filas.length === 0) return <p className="mu">Todavía no hiciste pedidos.</p>
  return (filas || []).map((p) => {
    const [clase, texto] = ESTADOS[p.estado]
    return (
      <div key={p.id} className="card">
        <div className="row">
          <b>Pedido N.º {p.numero}</b>
          <span className={'pill ' + clase}>{texto}</span>
        </div>
        <p className="mu">{fechaHora(p.creado_en)} · {PAGO_TXT[p.pago]}</p>
        {p.pedido_items.map((i) => <p key={i.id}>{i.cantidad} × {i.nombre}{i.formato ? ' (' + i.formato + ')' : ''}</p>)}
        <p className="pts" style={{ marginTop: 6 }}>{p.pago === 'puntos' ? fmt(p.total_puntos) + ' pts' : pesos(p.total_pesos)}</p>
      </div>
    )
  })
}
