import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { fmt, plata, fechaHora, TIPOS } from '../ui'
import ResumenPuntos from '../ResumenPuntos'

export default function Movimientos({ socios, esAdmin }) {
  const [vista, setVista] = useState('puntos')
  return (
    <>
      <div className="chips">
        <button type="button" className={'chip' + (vista === 'puntos' ? ' on' : '')} onClick={() => setVista('puntos')}>Puntos</button>
        <button type="button" className={'chip' + (vista === 'dinero' ? ' on' : '')} onClick={() => setVista('dinero')}>Compras, entradas y cuotas</button>
        {esAdmin && <button type="button" className={'chip' + (vista === 'resumen' ? ' on' : '')} onClick={() => setVista('resumen')}>Resumen de puntos</button>}
      </div>
      {vista === 'puntos' && <MovimientosPuntos socios={socios} />}
      {vista === 'dinero' && <MovimientosDinero socios={socios} />}
      {vista === 'resumen' && esAdmin && <ResumenPuntos />}
    </>
  )
}

function MovimientosDinero({ socios }) {
  const [f, setF] = useState({ socio: '', desde: '', hasta: '' })
  const [filas, setFilas] = useState([])
  const [error, setError] = useState('')
  useEffect(() => {
    let vigente = true
    supabase.rpc('movimientos_dinero', { p_desde: f.desde || null, p_hasta: f.hasta || null, p_socio: f.socio || null })
      .then(({ data, error }) => { if (vigente) { setError(error ? error.message : ''); setFilas(data || []) } })
    return () => { vigente = false }
  }, [f])
  const cambiar = (campo) => (e) => setF({ ...f, [campo]: e.target.value })
  return (
    <>
      <div className="filtros card">
        <div>
          <label htmlFor="ds">Socio</label>
          <select id="ds" value={f.socio} onChange={cambiar('socio')}>
            <option value="">Todos</option>
            {socios.map((s) => <option key={s.id} value={s.id}>N.º {String(s.numero_socio).padStart(4, '0')} - {s.nombre || 'Sin nombre'}</option>)}
          </select>
        </div>
        <div><label htmlFor="dd">Desde</label><input id="dd" type="date" value={f.desde} onChange={cambiar('desde')} /></div>
        <div><label htmlFor="dh">Hasta</label><input id="dh" type="date" value={f.hasta} onChange={cambiar('hasta')} /></div>
      </div>
      {error && <p className="msg error">{error}</p>}
      <div className="card scroll">
        <table>
          <thead><tr><th>Fecha</th><th>Socio</th><th>Origen</th><th>Detalle</th><th>Pesos</th><th>Puntos</th><th>Pago</th></tr></thead>
          <tbody>
            {filas.map((r, i) => (
              <tr key={i}>
                <td>{fechaHora(r.fecha)}</td>
                <td>N.º {String(r.socio_numero).padStart(4, '0')} - {r.socio_nombre || 'Sin nombre'}</td>
                <td>{r.origen}</td>
                <td className="mu">{r.detalle}{r.estado === 'pendiente' ? ' (sin cobrar)' : ''}</td>
                <td>{Number(r.pesos) > 0 ? '$ ' + plata(r.pesos) : '-'}</td>
                <td>{Number(r.puntos) > 0 ? fmt(r.puntos) : '-'}</td>
                <td className="mu">{r.pago}</td>
              </tr>
            ))}
            {filas.length === 0 && <tr><td colSpan="7" className="mu">No hay movimientos con estos filtros.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mu">Se muestran hasta 500 movimientos, del más nuevo al más viejo. Las compras de la tienda cuentan cuando se entregan.</p>
    </>
  )
}

function MovimientosPuntos({ socios }) {
  const [f, setF] = useState({ socio: '', tipo: '', desde: '', hasta: '' })
  const [filas, setFilas] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let vigente = true
    async function buscar() {
      let q = supabase
        .from('movimientos_puntos')
        .select('id, tipo, puntos, litros, descripcion, creado_en, socio_id, perfiles(nombre, numero_socio)')
      if (f.socio) q = q.eq('socio_id', f.socio)
      if (f.tipo) q = q.eq('tipo', f.tipo)
      if (f.desde) q = q.gte('creado_en', new Date(f.desde + 'T00:00:00').toISOString())
      if (f.hasta) q = q.lte('creado_en', new Date(f.hasta + 'T23:59:59').toISOString())
      const { data, error } = await q.order('creado_en', { ascending: false }).limit(500)
      if (!vigente) return
      setError(error ? error.message : '')
      setFilas(data || [])
    }
    buscar()
    return () => { vigente = false }
  }, [f])

  const cambiar = (campo) => (e) => setF({ ...f, [campo]: e.target.value })
  const total = (tipo) => filas.filter((r) => r.tipo === tipo).reduce((a, r) => a + Number(r.puntos), 0)

  return (
    <>
      <div className="filtros card">
        <div>
          <label htmlFor="fs">Socio</label>
          <select id="fs" value={f.socio} onChange={cambiar('socio')}>
            <option value="">Todos</option>
            {socios.map((s) => (
              <option key={s.id} value={s.id}>N.º {String(s.numero_socio).padStart(4, '0')} - {s.nombre || 'Sin nombre'}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ft">Tipo</label>
          <select id="ft" value={f.tipo} onChange={cambiar('tipo')}>
            <option value="">Todos</option>
            {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="fd">Desde</label>
          <input id="fd" type="date" value={f.desde} onChange={cambiar('desde')} />
        </div>
        <div>
          <label htmlFor="fh">Hasta</label>
          <input id="fh" type="date" value={f.hasta} onChange={cambiar('hasta')} />
        </div>
      </div>

      <div className="chips">
        {Object.entries(TIPOS).map(([k, v]) => (
          <span key={k} className="chip">{v}: <b className={total(k) >= 0 ? 'plus' : 'minus'}>{fmt(total(k))}</b></span>
        ))}
      </div>

      {error && <p className="msg error">{error}</p>}
      <div className="card scroll">
        <table>
          <thead>
            <tr><th>Fecha</th><th>Socio</th><th>Tipo</th><th>Puntos</th><th>Detalle</th></tr>
          </thead>
          <tbody>
            {filas.map((r) => (
              <tr key={r.id}>
                <td>{fechaHora(r.creado_en)}</td>
                <td>{r.perfiles ? `N.º ${String(r.perfiles.numero_socio).padStart(4, '0')} - ${r.perfiles.nombre}` : '-'}</td>
                <td>{TIPOS[r.tipo]}</td>
                <td className={r.puntos > 0 ? 'plus' : 'minus'}>{r.puntos > 0 ? '+' : ''}{fmt(r.puntos)}</td>
                <td className="mu">{r.descripcion}</td>
              </tr>
            ))}
            {filas.length === 0 && <tr><td colSpan="5" className="mu">No hay movimientos con estos filtros.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mu">Se muestran hasta 500 movimientos, del más nuevo al más viejo.</p>
    </>
  )
}
