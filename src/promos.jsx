// Promociones de los productos: porcentaje, 2x1, delivery gratis y happy hour.
// Cada una se activa a mano y puede tener vencimiento. El precio final lo calcula también el servidor (crear_pedido).
import { useEffect, useState } from 'react'
import { plata } from './ui'

export const PROMOS = [
  { id: 'pct', nombre: 'Descuento en %', corto: 'OFF', cambiaPrecio: true },
  { id: '2x1', nombre: '2x1', corto: '2x1', cambiaPrecio: true },
  { id: 'delivery', nombre: 'Delivery gratis', corto: 'Delivery gratis', cambiaPrecio: false },
  { id: 'happy', nombre: 'Happy hour', corto: 'Happy hour', cambiaPrecio: false },
]

const redondear = (n) => Math.round(n * 100) / 100

// ¿La promoción está activa y no venció?
export function vigente(p, tipo, ahora = Date.now()) {
  if (!p || !p['promo_' + tipo + '_activa']) return false
  if (tipo === 'pct' && !(Number(p.promo_pct) > 0)) return false
  const hasta = p['promo_' + tipo + '_hasta']
  return !hasta || new Date(hasta).getTime() > ahora
}

export const hayPromo = (p, ahora) => PROMOS.some((x) => vigente(p, x.id, ahora))

// Descuento de una línea (en pesos). Solo rige pagando en efectivo o transferencia; el 2x1 no se combina con el porcentaje.
export function descuentoLinea(p, cantidad, pago, ahora = Date.now()) {
  if (pago === 'puntos') return { monto: 0, tipo: null }
  const precio = Number(p.precio_pesos)
  if (vigente(p, '2x1', ahora)) return cantidad >= 2 ? { monto: redondear(Math.floor(cantidad / 2) * precio), tipo: '2x1' } : { monto: 0, tipo: null }
  if (vigente(p, 'pct', ahora)) return { monto: redondear((precio * cantidad * Number(p.promo_pct)) / 100), tipo: 'pct' }
  return { monto: 0, tipo: null }
}

export const etiquetaPromo = (tipo, p) => (tipo === 'pct' ? plata(p.promo_pct) + '% OFF' : tipo === '2x1' ? '2x1' : PROMOS.find((x) => x.id === tipo).nombre)

// Texto corto para los pedidos ya hechos: "(2x1: −$ 1.500)".
export const textoPromoItem = (i) => (Number(i.descuento_pesos) > 0 ? ' · ' + (i.promo || 'Promo') + ': −$ ' + plata(i.descuento_pesos) : '')

function restante(hasta, ahora) {
  const s = Math.max(0, Math.floor((new Date(hasta).getTime() - ahora) / 1000))
  if (s >= 86400) {
    const d = Math.floor(s / 86400)
    const h = Math.floor((s % 86400) / 3600)
    return 'Quedan ' + d + (d === 1 ? ' día' : ' días') + ' y ' + h + (h === 1 ? ' hora' : ' horas')
  }
  const dos = (n) => String(n).padStart(2, '0')
  return 'Termina en ' + dos(Math.floor(s / 3600)) + ':' + dos(Math.floor((s % 3600) / 60)) + ':' + dos(s % 60)
}

// Cuenta regresiva en vivo. Al llegar a cero avisa para que la tienda se actualice.
export function Contador({ hasta, onFin }) {
  const [ahora, setAhora] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const fin = new Date(hasta).getTime() <= ahora
  useEffect(() => { if (fin && onFin) onFin() }, [fin]) // eslint-disable-line react-hooks/exhaustive-deps
  if (fin) return null
  return <span className="num">{restante(hasta, ahora)}</span>
}

// Chapitas, condición y contadores que se ven sobre el producto en la tienda.
export function PromosProducto({ p, ahora, onFin }) {
  const activas = PROMOS.filter((x) => vigente(p, x.id, ahora))
  if (activas.length === 0) return null
  const conPrecio = activas.some((x) => x.cambiaPrecio)
  return (
    <div style={{ margin: '6px 0' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {activas.map((x) => (
          <span key={x.id} className="pill warn" style={{ fontWeight: 700 }}>
            {x.id === 'pct' ? plata(p.promo_pct) + '% OFF' : x.id === '2x1' ? '2x1 · Llevá 2, pagá 1' : x.nombre}
          </span>
        ))}
      </div>
      {conPrecio && <p className="mu" style={{ fontSize: 13, marginTop: 4 }}>Solo efectivo o transferencia (con puntos no aplica).</p>}
      {activas.some((x) => x.id === 'delivery') && <p className="mu" style={{ fontSize: 13 }}>Delivery gratis: el envío de este producto no tiene costo.</p>}
      {activas.map((x) => p['promo_' + x.id + '_hasta'] && (
        <p key={x.id} className="mu" style={{ fontSize: 13 }}>
          {x.id === 'pct' ? plata(p.promo_pct) + '% OFF' : x.nombre}: <Contador hasta={p['promo_' + x.id + '_hasta']} onFin={onFin} />
        </p>
      ))}
    </div>
  )
}

// ---- Edición (productor y administrador) ----

const aLocal = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return z.toISOString().slice(0, 16)
}
const finDeHoy = () => { const d = new Date(); d.setHours(23, 59, 0, 0); return d.toISOString() }
const finDeSemana = () => {
  const d = new Date()
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7)) // domingo
  d.setHours(23, 59, 0, 0)
  return d.toISOString()
}
const enDosHoras = () => new Date(Date.now() + 2 * 3600 * 1000).toISOString()

function UnaPromo({ promo, r, set, id }) {
  const activa = !!r['promo_' + promo.id + '_activa']
  const hasta = r['promo_' + promo.id + '_hasta'] || null
  const vencida = activa && hasta && new Date(hasta).getTime() <= Date.now()
  const poner = (c, v) => set('promo_' + promo.id + '_' + c, v)
  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="row">
        <b>{promo.nombre}</b>
        <button type="button" className={'chip' + (activa ? ' on' : '')} aria-pressed={activa} onClick={() => poner('activa', !activa)}>
          {activa ? 'Activada' : 'Apagada'}
        </button>
      </div>
      {promo.id === 'pct' && (
        <div style={{ marginTop: 6 }}>
          <label htmlFor={id + '-pct'}>Porcentaje de descuento (%)</label>
          <input id={id + '-pct'} type="number" min="1" max="99" step="1" value={r.promo_pct ?? ''} onChange={(e) => set('promo_pct', e.target.value)} />
        </div>
      )}
      {promo.id === '2x1' && <p className="mu">Con unidades iguales se cobra la mitad (2 pagan 1, 3 pagan 2, 4 pagan 2). No se combina con el porcentaje.</p>}
      {promo.id === 'delivery' && <p className="mu">Solo aviso: el mensaje de WhatsApp del pedido dice que el envío no tiene costo.</p>}
      {promo.id === 'happy' && <p className="mu">Solo aviso visual en la tienda.</p>}
      {promo.cambiaPrecio && <p className="mu">Rige solo pagando en efectivo o transferencia.</p>}
      {activa && (
        <div style={{ marginTop: 8 }}>
          <label>¿Hasta cuándo?</label>
          <div className="chips" style={{ marginTop: 0 }}>
            <button type="button" className="chip" onClick={() => poner('hasta', enDosHoras())}>2 horas</button>
            <button type="button" className="chip" onClick={() => poner('hasta', finDeHoy())}>Hoy</button>
            <button type="button" className="chip" onClick={() => poner('hasta', finDeSemana())}>Este fin de semana</button>
            <button type="button" className={'chip' + (!hasta ? ' on' : '')} onClick={() => poner('hasta', null)}>Sin vencimiento</button>
          </div>
          <label htmlFor={id + '-' + promo.id + '-h'}>O elegí fecha y hora exacta</label>
          <input id={id + '-' + promo.id + '-h'} type="datetime-local" value={aLocal(hasta)}
            onChange={(e) => poner('hasta', e.target.value ? new Date(e.target.value).toISOString() : null)} />
          <p className={vencida ? 'msg error' : 'mu'}>
            {!hasta ? 'Sin vencimiento: la apagás vos.' : vencida ? 'Esa fecha ya pasó: elegí una nueva o no se va a ver.' : 'Se apaga sola el ' + new Date(hasta).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) + '. Guardá el producto para aplicarla.'}
          </p>
        </div>
      )}
    </div>
  )
}

export function PromosEditor({ r, set, id }) {
  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <label>Promociones (se activan a mano; recordá guardar)</label>
      {PROMOS.map((x) => <UnaPromo key={x.id} promo={x} r={r} set={set} id={id} />)}
    </div>
  )
}

// Campos de promoción que se guardan junto con el producto.
export function datosPromo(r) {
  const out = {}
  PROMOS.forEach((x) => {
    out['promo_' + x.id + '_activa'] = !!r['promo_' + x.id + '_activa']
    out['promo_' + x.id + '_hasta'] = r['promo_' + x.id + '_activa'] ? (r['promo_' + x.id + '_hasta'] || null) : null
  })
  const pct = Math.floor(Number(r.promo_pct))
  out.promo_pct = Number.isFinite(pct) && pct > 0 ? Math.min(99, pct) : null
  if (out.promo_pct_activa && !out.promo_pct) out.promo_pct_activa = false
  return out
}
