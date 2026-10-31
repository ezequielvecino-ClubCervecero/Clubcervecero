// Tienda del socio: secciones, carrito, pedido y mensaje de WhatsApp.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Icon, Msg, Acordeon, fmt, fechaHora } from '../ui'
import MasVendidos from '../MasVendidos'
import { cuando } from '../TiendaControl'

const PAGOS = [['efectivo', 'Efectivo en el local'], ['transferencia', 'Transferencia'], ['puntos', 'Puntos']]
const PAGO_TXT = Object.fromEntries(PAGOS)
const ENTREGAS = [['retiro', 'Retiro en el local'], ['envio', 'Envío a domicilio']]
const pesos = (n) => '$ ' + fmt(n)
const ESTADOS = { pendiente: ['warn', 'Pendiente'], confirmado: ['ok', 'Entregado'], no_entregado: ['bad', 'No entregado'], cancelado: ['bad', 'Cancelado'], rechazado: ['bad', 'Rechazado'], vencido: ['bad', 'Sin respuesta (cancelado)'] }
// Cervecería de cada producto: la del productor, o el nombre del club (se edita en Marca).
const cerveceriaDe = (p, club) => (p.productor_id ? (p.productores && p.productores.cerveceria) || 'Cervecería sin nombre' : club || 'Club Cervecero')

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
  const [masAbierto, setMasAbierto] = useState(false)
  const [tiendas, setTiendas] = useState({})

  const cargar = useCallback(async () => {
    const [s, p, c, sd, et] = await Promise.all([
      supabase.from('tienda_secciones').select('*').eq('visible', true).order('orden'),
      supabase.from('tienda_productos').select('*, productores(cerveceria)').eq('activo', true).gt('stock', 0).order('nombre'),
      supabase.from('configuracion').select('whatsapp, aviso_envio, cerveceria_club').eq('id', 1).single(),
      supabase.rpc('saldo_disponible', { p_socio: perfil.id }),
      supabase.rpc('estado_tiendas'),
    ])
    const vis = s.data || []
    setSecciones(vis)
    setProductos((p.data || []).filter((x) => vis.some((v) => v.id === x.seccion)))
    setConfig(c.data || {})
    setSaldo(sd.data ?? 0)
    setTiendas(Object.fromEntries((et.data || []).map((t) => [t.productor_id || '', t])))
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
  const vendedores = new Set(lineas.map((l) => l.productor_id || '')).size

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
    // Un pedido por cervecería: cada uno lleva su propio mensaje, al WhatsApp de quien lo atiende.
    const hechos = (data.pedidos || []).map((ped) => {
      const propias = lineas.filter((l) => (l.productor_id || null) === (ped.productor_id || null))
      const texto = armarMensaje({ ...snapshot, lineas: propias, numero: ped.numero, perfil, totalPesos: Number(ped.total_pesos), totalPuntos: Number(ped.total_puntos) })
      const destino = ped.productor_id ? ped.whatsapp : config.whatsapp
      return {
        numero: ped.numero, productor: !!ped.productor_id, cerveceria: ped.cerveceria || config.cerveceria_club || 'Club Cervecero',
        url: destino ? 'https://wa.me/' + destino + '?text=' + encodeURIComponent(texto) : null,
      }
    })
    setListo(hechos)
    setCarrito({})
    setDireccion('')
    setVersion((v) => v + 1)
    cargar()
  }

  if (listo) {
    return (
      <div className="card" style={{ borderColor: 'var(--am)' }}>
        <h3>{listo.length === 1 ? 'Pedido N.º ' + listo[0].numero + ' hecho' : 'Hiciste ' + listo.length + ' pedidos'}</h3>
        <p className="mu" style={{ margin: '8px 0 12px' }}>
          Quedan pendientes hasta que cada cervecería los confirme. Mandá el detalle por WhatsApp para coordinar.
        </p>
        {listo.map((h) => (
          <div key={h.numero} className="card">
            <b>Pedido N.º {h.numero} · {h.cerveceria}</b>
            {h.productor && <p className="mu">Tiene 30 minutos para aceptarlo. Si no responde, se cancela solo y se devuelven stock y puntos.</p>}
            {h.url
              ? <a className="btn pri" style={{ marginTop: 8 }} href={h.url} target="_blank" rel="noreferrer">Enviar por WhatsApp</a>
              : <p className="msg error">{h.productor ? 'Esta cervecería todavía no cargó su WhatsApp, pero el pedido ya le llegó a la app.' : 'El negocio todavía no cargó su número de WhatsApp. Avisale al local en persona.'}</p>}
          </div>
        ))}
        <div style={{ marginTop: 12 }}><button className="btn" onClick={() => setListo(null)}>Seguir comprando</button></div>
      </div>
    )
  }

  const visibles = productos.filter((p) => p.seccion === seccion)
  const tiendaDe = (p) => tiendas[p.productor_id || '']
  const cerrada = (p) => !!tiendaDe(p) && tiendaDe(p).abierta === false
  const avisoCierre = (p) => {
    const t = tiendaDe(p)
    return 'Tienda cerrada por ahora' + (t && t.proxima_apertura ? ': abre el ' + cuando(t.proxima_apertura) : '') + '.'
  }
  const clubCerrado = tiendas[''] && tiendas[''].abierta === false

  return (
    <>
      <h2 style={{ marginTop: 6 }}>Tienda</h2>
      {clubCerrado && <p className="msg error">La tienda del club está cerrada por ahora{tiendas[''].proxima_apertura ? ': abre el ' + cuando(tiendas[''].proxima_apertura) : ''}. Podés mirar los productos, pero todavía no comprar.</p>}
      <Acordeon titulo="Más vendidos" icono="crown" abierto={masAbierto} onToggle={() => setMasAbierto((a) => !a)}>
        <MasVendidos />
      </Acordeon>
      {secciones.length === 0 && <p className="mu">La tienda no tiene secciones disponibles por ahora.</p>}
      <div className="chips">
        {secciones.map((s) => (
          <button key={s.id} className={'chip' + (s.id === seccion ? ' on' : '')} onClick={() => setSeccion(s.id)}>{s.nombre}</button>
        ))}
      </div>
      {secciones.length > 0 && visibles.length === 0 && <p className="mu">No hay productos en esta sección.</p>}
      {visibles.map((p) => (
        <div key={p.id} className="card row">
          <div className="row" style={{ flex: 1, minWidth: 190, flexWrap: 'nowrap', justifyContent: 'flex-start', gap: 12 }}>
            {p.imagen_url && <img className="prod-img" src={p.imagen_url} alt={p.nombre} loading="lazy" />}
            <div style={{ flex: 1, minWidth: 0 }}>
            <b>{p.nombre}</b>{p.formato ? <span className="mu"> · {p.formato}</span> : null}
            <p className="mu">Cervecería: <b>{cerveceriaDe(p, config.cerveceria_club)}</b></p>
            {p.descripcion && <p className="mu">{p.descripcion}</p>}
            <p>{pesos(p.precio_pesos)}{p.precio_puntos != null && <span className="pts" style={{ fontSize: 15 }}> · {fmt(p.precio_puntos)} pts</span>}</p>
            {p.stock <= 5 && <p className="mu">Quedan {p.stock}</p>}
            {cerrada(p) && p.productor_id && <p className="msg error">{avisoCierre(p)}</p>}
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" aria-label={'Quitar uno de ' + p.nombre} disabled={!carrito[p.id]} onClick={() => cambiar(p, -1)}>−</button>
            <b aria-live="polite">{carrito[p.id] || 0}</b>
            <button className="btn" aria-label={'Agregar uno de ' + p.nombre} disabled={cerrada(p) || (carrito[p.id] || 0) >= p.stock} onClick={() => cambiar(p, 1)}>+</button>
          </div>
        </div>
      ))}

      {lineas.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--am)' }}>
          <h3>Tu pedido</h3>
          {vendedores > 1 && <p className="mu">Tu carrito tiene productos de {vendedores} cervecerías: se hacen {vendedores} pedidos separados y cada cervecería confirma el suyo.</p>}
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
          <MisPedidos perfil={perfil} version={version} club={config.cerveceria_club} />
        </Acordeon>
      </div>
    </>
  )
}

function MisPedidos({ perfil, version, club }) {
  const [filas, setFilas] = useState(null)
  useEffect(() => {
    supabase.from('pedidos').select('*, pedido_items(*), productores(cerveceria)').eq('socio_id', perfil.id)
      .order('creado_en', { ascending: false }).limit(10)
      .then(({ data }) => setFilas(data || []))
  }, [perfil.id, version])

  if (filas && filas.length === 0) return <p className="mu">Todavía no hiciste pedidos.</p>
  return (filas || []).map((p) => {
    const [clase, texto] = p.estado === 'aceptado' ? ['warn', p.entrega === 'envio' ? 'Envío en proceso' : 'Listo para retirar'] : ESTADOS[p.estado]
    return (
      <div key={p.id} className="card">
        <div className="row">
          <b>Pedido N.º {p.numero}</b>
          <span className={'pill ' + clase}>{texto}</span>
        </div>
        <p className="mu">{fechaHora(p.creado_en)} · {PAGO_TXT[p.pago]}</p>
        <p className="mu">Cervecería: {p.productor_id ? (p.productores && p.productores.cerveceria) || '-' : club || 'Club Cervecero'}</p>
        {p.pedido_items.map((i) => <p key={i.id}>{i.cantidad} × {i.nombre}{i.formato ? ' (' + i.formato + ')' : ''}</p>)}
        <p className="pts" style={{ marginTop: 6 }}>{p.pago === 'puntos' ? fmt(p.total_puntos) + ' pts' : pesos(p.total_pesos)}</p>
      </div>
    )
  })
}
