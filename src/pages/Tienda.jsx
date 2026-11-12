// Tienda del socio: secciones, carrito, pedido y mensaje de WhatsApp.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { PromosProducto, descuentoLinea, vigente, etiquetaPromo, textoPromoItem, hayPromo } from '../promos'
import { Icon, Msg, Acordeon, fmt, plata, fechaHora } from '../ui'
import Reloj from '../Reloj'
import { textosWa } from '../whatsapp'
import { BotonUbicacion, BotonBuscar, useDirecciones, linkMapas } from '../Direcciones'

const PAGOS = [['efectivo', 'Efectivo en el local'], ['transferencia', 'Transferencia'], ['puntos', 'Puntos']]
const PAGO_TXT = Object.fromEntries(PAGOS)
const ENTREGAS = [['retiro', 'Retiro en el local'], ['envio', 'Envío a domicilio']]
const pesos = (n) => '$ ' + plata(n)
const ESTADOS = { pendiente: ['warn', 'En espera de confirmación'], confirmado: ['ok', 'Entregado'], no_entregado: ['bad', 'No entregado'], cancelado: ['bad', 'Cancelado'], rechazado: ['bad', 'Rechazado'], vencido: ['bad', 'Sin respuesta (cancelado)'] }
// Cervecería de cada producto: la del productor, o el nombre del club (se edita en Marca).
const cerveceriaDe = (p, club) => (p.productor_id ? (p.productores && p.productores.cerveceria) || 'Cervecería sin nombre' : club || 'Club Cervecero')

const kmTxt = (n) => (Number(n) % 1 === 0 ? String(Number(n)) : String(Number(n)).replace('.', ',')) + ' km'

function armarMensaje({ numero, perfil, lineas, pago, entrega, direccion, mapa, totalPesos, totalPuntos, aviso, textos }) {
  const T = textosWa(textos)
  const L = []
  L.push(T.saludo.replace('{numero}', numero))
  L.push(T.socio + ' ' + String(perfil.numero_socio).padStart(4, '0') + (perfil.nombre ? ' - ' + perfil.nombre : ''))
  L.push('')
  lineas.forEach((l) => {
    const precio = pago === 'puntos' ? fmt(l.precio_puntos * l.cantidad) + ' pts' : pesos(l.precio_pesos * l.cantidad - l.desc)
    L.push('• ' + l.cantidad + ' x ' + l.nombre + (l.formato ? ' (' + l.formato + ')' : '') + ' - ' + precio + (l.desc > 0 ? ' (' + etiquetaPromo(l.promoTipo, l) + ')' : ''))
  })
  const gratis = entrega === 'envio' ? lineas.filter((l) => l.deliveryGratis) : []
  if (gratis.length > 0) L.push('Envío sin costo (promo Delivery gratis: ' + gratis.map((l) => l.nombre).join(', ') + ')')
  L.push('')
  L.push(T.total + ' ' + (pago === 'puntos' ? fmt(totalPuntos) + ' puntos' : pesos(totalPesos)))
  L.push(T.pago + ' ' + PAGO_TXT[pago])
  L.push(entrega === 'envio' ? T.envio + ' ' + direccion : T.retiro)
  if (entrega === 'envio' && mapa) L.push(T.ubicacion + ' ' + mapa)
  if (entrega === 'envio' && aviso) { L.push(''); L.push(aviso) }
  if (T.cierre.trim()) { L.push(''); L.push(T.cierre.trim()) }
  return L.join('\n')
}

export default function Tienda({ perfil }) {
  const [secciones, setSecciones] = useState([])
  const [productos, setProductos] = useState([])
  const [config, setConfig] = useState({})
  const [saldo, setSaldo] = useState(0)
  const [seccion, setSeccion] = useState('todos')
  const [formatoSel, setFormatoSel] = useState(null)
  const [estiloSel, setEstiloSel] = useState(null)
  const [orden, setOrden] = useState('cercania')
  const [carrito, setCarrito] = useState({})
  const [pago, setPago] = useState('efectivo')
  const [entrega, setEntrega] = useState('retiro')
  const [direccion, setDireccion] = useState('')
  const [coords, setCoords] = useState(null)
  const [guardadas, recargarDirs] = useDirecciones(perfil.id)
  const [dirSel, setDirSel] = useState(null) // id de una guardada, o 'nueva'
  const [msg, setMsg] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState(null)
  const [abierta, setAbierta] = useState(false)
  const [version, setVersion] = useState(0)
  const [tiendas, setTiendas] = useState({})
  const [cercania, setCercania] = useState(false)
  const [ubicGps, setUbicGps] = useState(null) // ubicación del celular, si la dio
  const [msgGps, setMsgGps] = useState(null)
  const [cerc, setCerc] = useState([]) // distancias desde la ubicación del cliente
  const [zona, setZona] = useState(null) // radios evaluados contra la dirección de entrega
  const [cervSel, setCervSel] = useState(null)
  const [ahora, setAhora] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 15000)
    return () => clearInterval(t)
  }, [])
  const alVencer = useCallback(() => setAhora(Date.now()), [])

  const cargar = useCallback(async () => {
    const [s, p, c, sd, et, ca] = await Promise.all([
      supabase.from('tienda_secciones').select('*').eq('visible', true).order('orden'),
      supabase.from('tienda_productos').select('*, productores(cerveceria), tienda_formatos(nombre), tienda_estilos(nombre)').eq('activo', true).gt('stock', 0).order('nombre'),
      supabase.from('configuracion').select('whatsapp, aviso_envio, cerveceria_club, wa_textos').eq('id', 1).single(),
      supabase.rpc('saldo_disponible', { p_socio: perfil.id }),
      supabase.rpc('estado_tiendas'),
      supabase.rpc('cercania_activa'),
    ])
    setCercania(!!ca.data)
    const vis = s.data || []
    setSecciones(vis)
    setProductos((p.data || []).filter((x) => vis.some((v) => v.id === x.seccion)))
    setConfig(c.data || {})
    setSaldo(sd.data ?? 0)
    setTiendas(Object.fromEntries((et.data || []).map((t) => [t.productor_id || '', t])))
    setSeccion((act) => (act === 'todos' || vis.some((v) => v.id === act) ? act : 'todos'))
  }, [perfil.id])
  useEffect(() => {
    cargar()
    // Se refresca solo: si una tienda cierra o abre, sus productos salen o vuelven.
    const t = setInterval(cargar, 60000)
    return () => clearInterval(t)
  }, [cargar])

  function cambiar(prod, delta) {
    setCarrito((c) => {
      const n = Math.min(prod.stock, Math.max(0, (c[prod.id] || 0) + delta))
      const sig = { ...c }
      if (n === 0) delete sig[prod.id]; else sig[prod.id] = n
      return sig
    })
  }

  // Los productos de una tienda cerrada no se muestran (y se sacan del carrito).
  const abiertos = useMemo(() => productos.filter((p) => {
    const t = tiendas[p.productor_id || '']
    return !(t && t.abierta === false)
  }), [productos, tiendas])
  useEffect(() => {
    setCarrito((c) => {
      const ids = Object.keys(c)
      if (ids.length === 0 || ids.every((id) => abiertos.some((p) => p.id === id))) return c
      return Object.fromEntries(ids.filter((id) => abiertos.some((p) => p.id === id)).map((id) => [id, c[id]]))
    })
  }, [abiertos])

  const lineas = abiertos.filter((p) => carrito[p.id]).map((p) => {
    const d = descuentoLinea(p, carrito[p.id], pago, ahora)
    return { ...p, cantidad: carrito[p.id], desc: d.monto, promoTipo: d.tipo, deliveryGratis: vigente(p, 'delivery', ahora) }
  })
  const promoSinPuntos = pago === 'puntos' && abiertos.some((p) => carrito[p.id] && (vigente(p, 'pct', ahora) || vigente(p, '2x1', ahora)))
  const totalPesos = lineas.reduce((a, l) => a + l.precio_pesos * l.cantidad - l.desc, 0)
  const hayDeliveryGratis = lineas.some((l) => l.deliveryGratis)
  const sePuedePuntos = lineas.length > 0 && lineas.every((l) => l.precio_puntos != null)
  const totalPuntos = sePuedePuntos ? lineas.reduce((a, l) => a + l.precio_puntos * l.cantidad, 0) : 0
  const puntosOk = sePuedePuntos && saldo >= totalPuntos
  const pagoValido = pago !== 'puntos' || puntosOk
  // Con direcciones guardadas se elige una; si no hay, se escribe una nueva.
  const modoNueva = dirSel === 'nueva' || guardadas.length === 0
  const elegida = !modoNueva ? (guardadas.find((d) => d.id === dirSel) || guardadas[0]) : null
  const dirFinal = elegida ? elegida.direccion : direccion.trim()
  const coordsFinal = elegida ? (elegida.lat != null ? { lat: Number(elegida.lat), lng: Number(elegida.lng) } : null) : coords
  const direccionOk = entrega === 'retiro' || dirFinal.length > 4
  const vendedores = new Set(lineas.map((l) => l.productor_id || '')).size

  // --- Cercanía ---
  // Ubicación del cliente: la del celular si la dio; si no, su dirección guardada más usada que tenga mapa.
  const dirConMapa = guardadas.find((d) => d.lat != null)
  const ubic = ubicGps || (dirConMapa ? { lat: Number(dirConMapa.lat), lng: Number(dirConMapa.lng) } : null)
  const ubLat = ubic ? ubic.lat : null
  const ubLng = ubic ? ubic.lng : null
  useEffect(() => {
    if (!cercania) { setCerc([]); return }
    let vivo = true
    supabase.rpc('cervecerias_cercanas', { p_lat: ubLat, p_lng: ubLng }).then(({ data }) => { if (vivo) setCerc(data || []) })
    return () => { vivo = false }
  }, [cercania, ubLat, ubLng, version])
  const cLat = coordsFinal ? coordsFinal.lat : null
  const cLng = coordsFinal ? coordsFinal.lng : null
  useEffect(() => {
    if (!cercania || entrega !== 'envio' || cLat == null) { setZona(null); return }
    let vivo = true
    supabase.rpc('cervecerias_cercanas', { p_lat: cLat, p_lng: cLng }).then(({ data }) => { if (vivo) setZona(data || []) })
    return () => { vivo = false }
  }, [cercania, entrega, cLat, cLng])
  const cercMap = useMemo(() => Object.fromEntries(cerc.map((r) => [r.productor_id, r])), [cerc])
  const zonaMap = useMemo(() => (zona ? Object.fromEntries(zona.map((r) => [r.productor_id, r])) : null), [zona])
  // Para cada cervecería del pedido: ¿hace envíos? ¿llega a la dirección? ¿falta saber dónde se entrega?
  const nombreDe = (k) => { const pr = productos.find((x) => (x.productor_id || '') === k); return pr ? cerveceriaDe(pr, config.cerveceria_club) : 'La cervecería' }
  const claves = [...new Set(lineas.map((l) => l.productor_id || ''))].filter((k) => k !== '')
  const noEnvia = cercania ? claves.filter((k) => cercMap[k] && cercMap[k].radio_envio_km !== null && Number(cercMap[k].radio_envio_km) === 0) : []
  const fuera = cercania ? claves.filter((k) => {
    const r = zonaMap ? zonaMap[k] : (coordsFinal ? null : cercMap[k])
    return r && Number(r.radio_envio_km) > 0 && r.dentro_radio === false
  }) : []
  const sinMapa = cercania && entrega === 'envio' && !coordsFinal
    ? claves.filter((k) => cercMap[k] && cercMap[k].ubicada && cercMap[k].radio_envio_km !== null && Number(cercMap[k].radio_envio_km) > 0)
    : []
  const sinEnvio = [...new Set([...noEnvia, ...fuera])]
  useEffect(() => { if (sinEnvio.length > 0) setEntrega((e) => (e === 'envio' ? 'retiro' : e)) }, [sinEnvio.length])

  function usarGps() {
    setMsgGps(null)
    if (!navigator.geolocation) return setMsgGps({ tipo: 'error', texto: 'Este dispositivo no permite usar la ubicación.' })
    navigator.geolocation.getCurrentPosition(
      (pos) => setUbicGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setMsgGps({ tipo: 'error', texto: err.code === 1 ? 'No diste permiso para usar la ubicación.' : 'No pude obtener la ubicación. Probá de nuevo.' }),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    )
  }

  async function confirmar() {
    setMsg(null)
    setEnviando(true)
    const snapshot = { lineas, pago, entrega, direccion: dirFinal, mapa: coordsFinal ? linkMapas(coordsFinal.lat, coordsFinal.lng) : null, totalPesos, totalPuntos, aviso: config.aviso_envio }
    const { data, error } = await supabase.rpc('crear_pedido', {
      p_items: lineas.map((l) => ({ producto_id: l.id, cantidad: l.cantidad })),
      p_pago: pago, p_entrega: entrega, p_direccion: entrega === 'envio' ? dirFinal : null,
      p_lat: entrega === 'envio' && coordsFinal ? coordsFinal.lat : null, p_lng: entrega === 'envio' && coordsFinal ? coordsFinal.lng : null,
    })
    setEnviando(false)
    if (error) { await cargar(); return setMsg({ tipo: 'error', texto: error.message }) }
    // La dirección queda guardada para la próxima compra (si falla, el pedido igual se hizo).
    if (entrega === 'envio') {
      await supabase.rpc('guardar_direccion', { p_direccion: dirFinal, p_lat: coordsFinal ? coordsFinal.lat : null, p_lng: coordsFinal ? coordsFinal.lng : null })
      recargarDirs()
    }
    // Un pedido por cervecería: cada uno lleva su propio mensaje, al WhatsApp de quien lo atiende.
    const hechos = (data.pedidos || []).map((ped) => {
      const propias = lineas.filter((l) => (l.productor_id || null) === (ped.productor_id || null))
      const texto = armarMensaje({ ...snapshot, textos: config.wa_textos, lineas: propias, numero: ped.numero, perfil, totalPesos: Number(ped.total_pesos), totalPuntos: Number(ped.total_puntos) })
      const destino = ped.productor_id ? ped.whatsapp : config.whatsapp
      return {
        numero: ped.numero, productor: !!ped.productor_id, cerveceria: ped.cerveceria || config.cerveceria_club || 'Club Cervecero',
        url: destino ? 'https://wa.me/' + destino + '?text=' + encodeURIComponent(texto) : null,
      }
    })
    setListo(hechos)
    setCarrito({})
    setDireccion('')
    setCoords(null)
    setDirSel(null)
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

  const ordenSeccion = Object.fromEntries(secciones.map((x, k) => [x.id, k]))
  const nombreSeccion = Object.fromEntries(secciones.map((x) => [x.id, x.nombre]))
  // Sin cercanía, "cercanía" y "promoción" no existen: se ordena por sección como siempre.
  const ordenEf = cercania ? orden : (orden === 'cercania' || orden === 'promo' ? 'seccion' : orden)

  // Cervecerías con productos publicados: abiertas primero (por cercanía o con promoción), cerradas al final.
  const grupos = (() => {
    const m = new Map()
    productos.forEach((p) => {
      const k = p.productor_id || ''
      if (!m.has(k)) {
        const t = tiendas[k]
        const c = cercMap[k]
        m.set(k, {
          k, nombre: cerveceriaDe(p, config.cerveceria_club), abierta: !(t && t.abierta === false), promo: false,
          dist: c && c.distancia_km != null ? Number(c.distancia_km) : null,
          radio: c ? c.radio_envio_km : null, dentro: c ? c.dentro_radio : null, direccion: c ? c.direccion : null,
        })
      }
      if (hayPromo(p, ahora)) m.get(k).promo = true
    })
    const dist = (g) => (g.dist == null ? 1e9 : g.dist)
    return [...m.values()].sort((a, b) =>
      (a.abierta === b.abierta ? 0 : a.abierta ? -1 : 1)
      || (ordenEf === 'promo' ? (a.promo === b.promo ? 0 : a.promo ? -1 : 1) : 0)
      || dist(a) - dist(b) || a.nombre.localeCompare(b.nombre))
  })()
  const rango = Object.fromEntries(grupos.map((g, i) => [g.k, i]))
  // Si la cervecería elegida cierra mientras se mira, se vuelve a "Todas".
  const cervEf = cervSel !== null && grupos.some((g) => g.k === cervSel && g.abierta) ? cervSel : null
  const masCerca = grupos.find((g) => g.abierta && g.dist != null)
  const deSeccion = abiertos.filter((p) => (seccion === 'todos' || p.seccion === seccion) && (!cercania || cervEf === null || (p.productor_id || '') === cervEf))
  // Formatos que hay en lo que se está viendo (para el filtro).
  const formatosHay = [...new Map(deSeccion.filter((p) => p.formato_id && p.tienda_formatos).map((p) => [p.formato_id, p.tienda_formatos.nombre])).entries()]
  const estilosHay = [...new Map(deSeccion.filter((p) => p.estilo_id && p.tienda_estilos).map((p) => [p.estilo_id, p.tienda_estilos.nombre])).entries()]
  const filtrados = deSeccion.filter((p) => (!formatoSel || p.formato_id === formatoSel) && (!estiloSel || p.estilo_id === estiloSel))
  const visibles = [...filtrados].sort((a, b) => {
    if (ordenEf === 'menor') return Number(a.precio_pesos) - Number(b.precio_pesos) || a.nombre.localeCompare(b.nombre)
    if (ordenEf === 'mayor') return Number(b.precio_pesos) - Number(a.precio_pesos) || a.nombre.localeCompare(b.nombre)
    if (ordenEf === 'cercania' || ordenEf === 'promo') {
      return (rango[a.productor_id || ''] ?? 99) - (rango[b.productor_id || ''] ?? 99)
        || (ordenEf === 'promo' ? Number(hayPromo(b, ahora)) - Number(hayPromo(a, ahora)) : 0)
        || (ordenSeccion[a.seccion] ?? 99) - (ordenSeccion[b.seccion] ?? 99) || a.nombre.localeCompare(b.nombre)
    }
    return (ordenSeccion[a.seccion] ?? 99) - (ordenSeccion[b.seccion] ?? 99) || a.nombre.localeCompare(b.nombre)
  })
  return (
    <>
      <h2 style={{ marginTop: 6 }}>Tienda</h2>
      {cercania && grupos.length > 0 && (
        <div className="card">
          <b>Cervecerías</b>
          {!ubic && (
            <>
              <p className="mu" style={{ marginTop: 4 }}>Para verlas de la más cercana a la más lejana, dejanos usar tu ubicación (o guardá una dirección de envío con mapa).</p>
              <button type="button" className="btn" style={{ marginTop: 8 }} onClick={usarGps}>Usar mi ubicación</button>
              <Msg m={msgGps} />
            </>
          )}
          <div className="chips" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <button type="button" className={'chip' + (cervEf === null ? ' on' : '')} style={{ textAlign: 'left' }} onClick={() => setCervSel(null)}>Todas las cervecerías</button>
            {grupos.map((g) => (
              <button key={g.k} type="button" className={'chip' + (cervEf === g.k ? ' on' : '')} style={{ textAlign: 'left', opacity: g.abierta ? 1 : 0.6 }}
                disabled={!g.abierta} onClick={() => setCervSel(g.k)}>
                <b>{g.nombre}</b>
                {g.dist != null && g.abierta && <span> · a {kmTxt(g.dist)}</span>}
                {!g.abierta && <span className="pill bad" style={{ marginLeft: 6 }}>Cerrada</span>}
                {g.abierta && masCerca && masCerca.k === g.k && <span className="pill ok" style={{ marginLeft: 6 }}>La más cercana</span>}
                {g.abierta && g.promo && <span className="pill warn" style={{ marginLeft: 6 }}>Promo</span>}
                {g.abierta && g.radio !== null && Number(g.radio) === 0 && <span className="pill warn" style={{ marginLeft: 6 }}>Solo retiro</span>}
                {g.abierta && g.radio !== null && Number(g.radio) > 0 && g.dentro === false && <span className="pill warn" style={{ marginLeft: 6 }}>Solo retiro en tu zona</span>}
                {g.abierta && g.radio !== null && Number(g.radio) > 0 && g.dentro !== false && <span className="mu"> · envía hasta {kmTxt(g.radio)}</span>}
                {g.direccion && <span className="mu" style={{ display: 'block', fontWeight: 400 }}>{g.direccion}</span>}
              </button>
            ))}
          </div>
          {ubic && <p className="mu">Las distancias son en línea recta, aproximadas.</p>}
        </div>
      )}
      <div className="chips chips-parejos">
        {[{ id: 'todos', nombre: 'Todos' }, ...secciones].map((s) => (
          <button key={s.id} className={'chip' + (s.id === seccion ? ' on' : '')} onClick={() => { setSeccion(s.id); setFormatoSel(null); setEstiloSel(null) }}>{s.nombre}</button>
        ))}
      </div>
      {formatosHay.length > 0 && (
        <div className="chips chips-parejos" aria-label="Filtrar por formato">
          <button className={'chip' + (!formatoSel ? ' on' : '')} onClick={() => setFormatoSel(null)}>Todos los formatos</button>
          {formatosHay.map(([id, nombre]) => (
            <button key={id} className={'chip' + (formatoSel === id ? ' on' : '')} onClick={() => setFormatoSel(id)}>{nombre}</button>
          ))}
        </div>
      )}
      {estilosHay.length > 0 && (
        <div className="chips chips-parejos" aria-label="Filtrar por estilo">
          <button className={'chip' + (!estiloSel ? ' on' : '')} onClick={() => setEstiloSel(null)}>Todos los estilos</button>
          {estilosHay.map(([id, nombre]) => (
            <button key={id} className={'chip' + (estiloSel === id ? ' on' : '')} onClick={() => setEstiloSel(id)}>{nombre}</button>
          ))}
        </div>
      )}
      <div className="row" style={{ justifyContent: 'flex-start', gap: 8, margin: '8px 0' }}>
        <label htmlFor="orden" className="mu" style={{ margin: 0 }}>Ordenar por</label>
        <select id="orden" style={{ flex: 1, width: '100%' }} value={ordenEf} onChange={(e) => setOrden(e.target.value)}>
          {cercania && <option value="cercania">Más cercanas primero</option>}
          {cercania && <option value="promo">Con promoción activa</option>}
          <option value="seccion">Sección</option>
          <option value="menor">Precio: de menor a mayor</option>
          <option value="mayor">Precio: de mayor a menor</option>
        </select>
      </div>
      {visibles.length === 0 && <p className="mu">No hay productos para mostrar.</p>}
      {visibles.map((p) => (
        <div key={p.id} className="card row">
          <div className="row" style={{ flex: 1, minWidth: 190, flexWrap: 'nowrap', justifyContent: 'flex-start', gap: 12 }}>
            {p.imagen_url && <img className="prod-img" src={p.imagen_url} alt={p.nombre} loading="lazy" />}
            <div style={{ flex: 1, minWidth: 0 }}>
            <b>{p.nombre}</b>{p.formato ? <span className="mu"> · {p.formato}</span> : null}
            {p.tienda_formatos && <span className="pill ok" style={{ marginLeft: 6 }}>{p.tienda_formatos.nombre}</span>}
            {p.tienda_estilos && <span className="pill warn" style={{ marginLeft: 6 }}>{p.tienda_estilos.nombre}</span>}
            {seccion === 'todos' && nombreSeccion[p.seccion] && <p className="mu">{nombreSeccion[p.seccion]}</p>}
            <p className="mu">Cervecería: <b>{cerveceriaDe(p, config.cerveceria_club)}</b>{cercania && cercMap[p.productor_id || ''] && cercMap[p.productor_id || ''].distancia_km != null ? ' · a ' + kmTxt(cercMap[p.productor_id || ''].distancia_km) : ''}</p>
            {p.descripcion && <p className="mu">{p.descripcion}</p>}
            <PromosProducto p={p} ahora={ahora} onFin={alVencer} />
            <p>{vigente(p, 'pct', ahora) && !vigente(p, '2x1', ahora)
              ? <><s className="mu">{pesos(p.precio_pesos)}</s> <b>{pesos(Math.round(p.precio_pesos * (100 - Number(p.promo_pct))) / 100)}</b></>
              : pesos(p.precio_pesos)}{p.precio_puntos != null && <span className="pts" style={{ fontSize: 15 }}> · {fmt(p.precio_puntos)} pts</span>}</p>
            {p.stock <= 5 && <p className="mu">Quedan {p.stock}</p>}
            </div>
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
          {vendedores > 1 && <p className="mu">Tu carrito tiene productos de {vendedores} cervecerías: se hacen {vendedores} pedidos separados y cada cervecería confirma el suyo.</p>}
          {lineas.map((l) => (
            <div key={l.id} style={{ marginTop: 6 }}>
              <div className="row">
                <span>{l.cantidad} × {l.nombre}{l.formato ? ' (' + l.formato + ')' : ''}</span>
                <span>{pago === 'puntos' && l.precio_puntos != null ? fmt(l.precio_puntos * l.cantidad) + ' pts' : pesos(l.precio_pesos * l.cantidad - l.desc)}</span>
              </div>
              {l.desc > 0 && (
                <p className="mu" style={{ fontSize: 13 }}>
                  {etiquetaPromo(l.promoTipo, l)}: ahorrás {pesos(l.desc)}
                  {l.promoTipo === '2x1' ? ' (' + Math.floor(l.cantidad / 2) + (Math.floor(l.cantidad / 2) === 1 ? ' unidad va gratis)' : ' unidades van gratis)') : ''}
                </p>
              )}
              {l.promoTipo === null && pago !== 'puntos' && vigente(l, '2x1', ahora) && l.cantidad < 2 && (
                <p className="mu" style={{ fontSize: 13 }}>2x1: agregá una unidad más y una va gratis.</p>
              )}
            </div>
          ))}
          <label>Forma de pago</label>
          <div className="chips" style={{ marginTop: 0 }}>
            {PAGOS.map(([id, t]) => (
              <button key={id} className={'chip' + (pago === id ? ' on' : '')} onClick={() => setPago(id)}>{t}</button>
            ))}
          </div>
          {promoSinPuntos && <p className="msg error">Con puntos no aplica la promoción: se paga el precio normal.</p>}
          {pago === 'puntos' && !pagoValido && (
            <p className="msg error">
              {!sePuedePuntos ? 'Algún producto del pedido no se puede pagar con puntos.' : 'Te faltan ' + fmt(totalPuntos - saldo) + ' puntos de saldo disponible.'}
            </p>
          )}
          <label>Entrega</label>
          <div className="chips" style={{ marginTop: 0 }}>
            {ENTREGAS.map(([id, t]) => (
              <button key={id} className={'chip' + (entrega === id ? ' on' : '')} disabled={id === 'envio' && sinEnvio.length > 0} onClick={() => setEntrega(id)}>{t}</button>
            ))}
          </div>
          {sinEnvio.length > 0 && (
            <p className="msg error">
              {sinEnvio.map(nombreDe).join(', ')} {sinEnvio.length === 1 ? 'no envía' : 'no envían'} a tu zona: solo retiro en el local.
              {sinEnvio.length > 0 && vendedores > 1 ? ' Si querés envío, hacé el pedido sin ' + (sinEnvio.length === 1 ? 'esa cervecería.' : 'esas cervecerías.') : ''}
            </p>
          )}
          {entrega === 'envio' && (
            <>
              <label>Dirección de entrega</label>
              {guardadas.length > 0 && (
                <div className="chips" style={{ marginTop: 0, flexDirection: 'column', alignItems: 'stretch' }}>
                  {guardadas.map((d) => (
                    <button key={d.id} type="button" className={'chip' + (!modoNueva && elegida && elegida.id === d.id ? ' on' : '')}
                      onClick={() => setDirSel(d.id)} style={{ textAlign: 'left' }}>{d.direccion}</button>
                  ))}
                  <button type="button" className={'chip' + (modoNueva ? ' on' : '')} onClick={() => setDirSel('nueva')}>Otra dirección</button>
                </div>
              )}
              {modoNueva && (
                <>
                  <input id="dir" aria-label="Dirección de entrega" placeholder="Calle, número y localidad" value={direccion}
                    onChange={(e) => { setDireccion(e.target.value); setCoords(null) }} />
                  {cercania && <BotonBuscar texto={direccion} onResultado={(r) => { setDireccion(r.direccion); setCoords({ lat: r.lat, lng: r.lng }) }} />}
                  <BotonUbicacion onResultado={(r) => { setDireccion(r.direccion); setCoords({ lat: r.lat, lng: r.lng }) }} />
                </>
              )}
              {sinMapa.length > 0 && (
                <p className="msg error" style={{ marginTop: 6 }}>
                  {sinMapa.map(nombreDe).join(', ')} {sinMapa.length === 1 ? 'envía' : 'envían'} hasta cierta distancia: para pedir envío ubicá la dirección en el mapa
                  ({guardadas.length > 0 ? 'elegí "Otra dirección" y tocá ' : 'tocá '}Buscar dirección o Usar mi ubicación).
                </p>
              )}
              {coordsFinal && <p className="mu" style={{ marginTop: 6 }}>Se va a mandar también el link de Google Maps con tu ubicación.</p>}
              {hayDeliveryGratis && <p className="msg ok" style={{ marginTop: 6 }}>Delivery gratis: {lineas.filter((l) => l.deliveryGratis).map((l) => l.nombre).join(', ')}. El envío de esos productos no tiene costo.</p>}
              {config.aviso_envio && <p className="mu" style={{ marginTop: 6 }}>{config.aviso_envio}</p>}
            </>
          )}
          <div className="row" style={{ marginTop: 14 }}>
            <b>Total</b>
            <span className="pts">{pago === 'puntos' ? fmt(totalPuntos) + ' pts' : pesos(totalPesos)}</span>
          </div>
          <button className="btn pri" style={{ marginTop: 12, width: '100%' }} disabled={enviando || !pagoValido || !direccionOk || sinMapa.length > 0} onClick={confirmar}>
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
        {p.estado === 'pendiente' && <Reloj creado={p.creado_en} />}
        <p className="mu">Cervecería: {p.productor_id ? (p.productores && p.productores.cerveceria) || '-' : club || 'Club Cervecero'}</p>
        {p.pedido_items.map((i) => <p key={i.id}>{i.cantidad} × {i.nombre}{i.formato ? ' (' + i.formato + ')' : ''}{textoPromoItem(i)}</p>)}
        <p className="pts" style={{ marginTop: 6 }}>{p.pago === 'puntos' ? fmt(p.total_puntos) + ' pts' : pesos(p.total_pesos)}</p>
      </div>
    )
  })
}
