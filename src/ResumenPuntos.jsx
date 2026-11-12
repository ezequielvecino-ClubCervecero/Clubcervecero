// Administrador: puntos generados, regalados y pagados en un período.
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { fmt, plata } from './ui'

const iso = (d) => d.toISOString().slice(0, 10)
const hoy = () => new Date()
const inicioMes = (d) => new Date(d.getFullYear(), d.getMonth(), 1)
const finMes = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0)

export default function ResumenPuntos() {
  const [f, setF] = useState({ desde: iso(inicioMes(hoy())), hasta: iso(hoy()) })
  const [r, setR] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let vigente = true
    supabase.rpc('resumen_puntos', { p_desde: f.desde, p_hasta: f.hasta }).then(({ data, error }) => {
      if (!vigente) return
      setError(error ? error.message : '')
      setR(error ? null : data)
    })
    return () => { vigente = false }
  }, [f])

  const mesAnterior = () => {
    const h = hoy(); const a = new Date(h.getFullYear(), h.getMonth() - 1, 1)
    setF({ desde: iso(a), hasta: iso(finMes(a)) })
  }

  const grupo = (titulo, clase, g, nota) => (
    <div className="card">
      <div className="row"><h3>{titulo}</h3><b className={clase} style={{ fontSize: 22 }}>{fmt(g.total)}</b></div>
      {nota && <p className="mu">{nota}</p>}
      {g.detalle.map((d) => (
        <div key={d.concepto} className="row" style={{ marginTop: 6 }}>
          <span className="mu">{d.concepto}</span><span>{fmt(d.puntos)}</span>
        </div>
      ))}
    </div>
  )

  return (
    <>
      <div className="filtros card">
        <div><label htmlFor="rp-d">Desde</label><input id="rp-d" type="date" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} /></div>
        <div><label htmlFor="rp-h">Hasta</label><input id="rp-h" type="date" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} /></div>
      </div>
      <div className="chips">
        <button type="button" className="chip" onClick={() => setF({ desde: iso(inicioMes(hoy())), hasta: iso(hoy()) })}>Este mes</button>
        <button type="button" className="chip" onClick={mesAnterior}>Mes anterior</button>
      </div>
      {error && <p className="msg error">{error}</p>}
      {r && (
        <>
          {grupo('Generados', 'plus', r.generados, 'Puntos que vienen de algo que el socio hizo.')}
          {grupo('Regalados', 'plus', r.regalados, 'Puntos que el club da sin contraprestación.')}
          {grupo('Pagados', 'minus', r.pagados, 'Puntos que los socios gastaron.')}
          <div className="card">
            <h3>A favor de los productores</h3>
            <p><b>{fmt(r.productores.puntos)}</b> puntos · valen $ {plata(r.productores.pesos)}</p>
            <p className="mu">Son pedidos pagados con puntos y entregados en cervecerías, e incluyen {fmt(r.productores.canjes)} puntos de canjes escaneados por productores. Ya están dentro de "Pagados".</p>
          </div>
          <p className="mu">Las transferencias de puntos entre socios no se cuentan: no cambian el total.</p>
        </>
      )}
    </>
  )
}
